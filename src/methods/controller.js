import { BehaviorSubject, fromEvent, merge, Subject } from "rxjs"
import { map, shareReplay, takeUntil, withLatestFrom, tap } from "rxjs/operators"
import {
	attachDragListeners,
	calculateDragDelta,
	calculateObjectShift,
	deleteSelectedObjects,
	getArrowKey,
	getDeleteKey,
	getNewObjectPosition,
	getSheetObjects,
	getSheetProps,
	handleObjectClasses,
	handleObjectDragStart,
	handleObjectSelection,
	inEditMode,
	setProps,
	shiftObjects,
	updateShadowElement,
} from "../operators"
import { getSheetObj, selectObjects } from "../util"

export default qlik => [
	"$scope",
	"$element",
	function($scope, $element) {
		/** get app */
		const app = $scope.ext.model.enigmaModel.app

		/** destroy listener */
		const destroy$ = new Subject()

		/** sheet props listener */
		const retrieveNewSheetProps$ = new Subject().pipe(takeUntil(destroy$))
		/** edit mode listener */
		const inEditMode$ = new BehaviorSubject(qlik.navigation.getMode()).pipe(
			map(mode => mode === "edit"),
			takeUntil(destroy$)
		)
		/** grid size */
		const gridSize$ = new BehaviorSubject(document.querySelector("#grid")).pipe(
			map(el => el.getBoundingClientRect()),
			map(({ width, height }) => ({ width: width - 4, height: height - 4 })),
			takeUntil(destroy$),
			shareReplay(1)
		)

		$scope.viz = { retrieveNewSheetProps$, inEditMode$, gridSize$, destroy$ }

		/** sheet obj */
		const sheetObj$ = getSheetObj(app, qlik).pipe(takeUntil(destroy$))

		/** listen for sheet invalidations */
		const sheetInvalidation$ = new Subject()
		/** invalidation function */
		const invalidationFunction = function() {
			sheetInvalidation$.next()
		}
		/** with sheet obj */
		sheetObj$.subscribe(obj => {
			/** bind invalidation function on invalidations */
			obj.Invalidated.bind(invalidationFunction)
		})
		/** on destroy */
		destroy$.pipe(withLatestFrom(sheetObj$)).subscribe(([_, obj]) => {
			/** unbind invalidation function */
			obj.Invalidated.unbind(invalidationFunction)
		})

		/** sheet properties */
		const sheetProps$ = merge(retrieveNewSheetProps$, sheetInvalidation$, inEditMode$).pipe(
			/** check for edit mode */
			inEditMode(inEditMode$),
			getSheetProps(sheetObj$),
			/** stop when destroy */
			takeUntil(destroy$)
		)

		/** get objects on sheet */
		const sheetObjects$ = sheetProps$.pipe(
			getSheetObjects(),
			shareReplay(1)
		)

		/** update object z-index */
		sheetObjects$.subscribe(objects => {
			objects.forEach(({ el }, i) => {
				el.style.zIndex = i + 1
			})
		})

		/** manage sheet selected objects */
		const { selectedObjects$, select: selectObject, clear: clearSelectedObjects } = selectObjects(destroy$)

		/** on document click */
		const documentClick$ = fromEvent(document, "click").pipe(
			/** check for edit mode */
			inEditMode(inEditMode$),
			/** stop on destroy */
			takeUntil(destroy$),
			shareReplay(1)
		)

		/** handle selected objects when click */
		documentClick$.pipe(handleObjectSelection(sheetObjects$, selectObject, clearSelectedObjects)).subscribe()

		/** handle object classes when selectedobjects updates */
		selectedObjects$.pipe(handleObjectClasses(sheetObjects$)).subscribe()

		/** on keydown */
		const documentKeyDown$ = fromEvent(document, "keydown").pipe(
			/** check edit mode */
			inEditMode(inEditMode$),
			/** stop on destroy */
			takeUntil(destroy$),
			shareReplay(1)
		)

		/** arrow keypress */
		const positionShift$ = documentKeyDown$.pipe(
			getArrowKey(),
			calculateObjectShift(gridSize$)
		)

		/** function to change position of objects by a delta value */
		const shiftObjects$ = new Subject().pipe(takeUntil(destroy$))

		/** on new position, get all selected objects and pass their position shift to shiftObjects$ */
		positionShift$.pipe(withLatestFrom(selectedObjects$)).subscribe(([{ direction, shift }, selectedObjects]) => {
			shiftObjects$.next(selectedObjects.map(id => ({ id, delta: { [direction]: shift } })))
		})

		/** on shiftObjects */
		shiftObjects$
			.pipe(
				/** check edit mode */
				inEditMode(inEditMode$),
				shiftObjects(sheetProps$),
				setProps(sheetObj$)
			)
			.subscribe()

		/** delete keypress */
		const deleteKeyPress$ = documentKeyDown$.pipe(getDeleteKey())

		/** on deleteKeyPress, delete selected objects */
		deleteKeyPress$.pipe(deleteSelectedObjects(sheetObj$, selectedObjects$)).subscribe()

		/** object dragging listeners */
		const objectDragStart$ = new Subject().pipe(takeUntil(destroy$))
		const objectDragging$ = new Subject().pipe(takeUntil(destroy$))
		const objectDragEnd$ = new Subject().pipe(takeUntil(destroy$))
		const isDragging$ = new Subject().pipe(takeUntil(destroy$))

		/** on sheetObjects$ */
		sheetObjects$
			.pipe(
				/** check edit mode */
				inEditMode(inEditMode$),
				attachDragListeners(objectDragStart$, objectDragging$, objectDragEnd$)
			)
			.subscribe()

		/** on objectDragStart$ */
		objectDragStart$
			.pipe(
				/** check edit mode */
				inEditMode(inEditMode$),
				handleObjectDragStart(objectDragging$, isDragging$)
			)
			.subscribe()

		/** on objectDragging$, calculate delta */
		const dragDelta$ = objectDragging$.pipe(
			/** check edit mode */
			inEditMode(inEditMode$),
			calculateDragDelta(objectDragStart$),
			shareReplay(1)
		)

		/** on dragDelta$ change */
		dragDelta$
			.pipe(
				/** check edit mode */
				inEditMode(inEditMode$),
				updateShadowElement()
			)
			.subscribe()

		/** on objectDragEnd */
		objectDragEnd$
			.pipe(
				/** check edit mode */
				inEditMode(inEditMode$),
				getNewObjectPosition(
					isDragging$,
					sheetObjects$,
					dragDelta$,
					gridSize$,
					sheetProps$,
					selectObject,
					clearSelectedObjects
				),
				setProps(sheetObj$)
			)
			.subscribe()
	},
]
