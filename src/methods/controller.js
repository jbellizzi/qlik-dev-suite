import { select, selectAll, event } from "d3-selection"
// import { drag } from "d3-drag"
import { drag } from "./drag"
import { Subject, from, BehaviorSubject, merge, fromEvent, of, Observable } from "rxjs"
import {
	withLatestFrom,
	switchMap,
	startWith,
	tap,
	shareReplay,
	map,
	scan,
	filter,
	mapTo,
	delay,
	takeUntil,
	take,
	mergeMap,
	pluck,
} from "rxjs/operators"
import noevent from "./drag/noevent"

export default qlik => [
	"$scope",
	"$element",
	function($scope, $element) {
		/** Initialize */
		// get current sheetid
		const currentSheetId = qlik.navigation.getCurrentSheetId().sheetId
		// get app model
		const app = $scope.ext.model.enigmaModel.app

		// get sheet object handle
		const sheetObj$ = from(app.getObject(currentSheetId)).pipe(shareReplay(1))
		// initialize subject listeners
		const sheetObjInvalidation$ = new Subject()
		const getSheetProps$ = new Subject()
		const getGridSize$ = new BehaviorSubject(document.querySelector("#grid").getBoundingClientRect())
		const gridSize$ = getGridSize$.pipe(
			map(({ width, height }) => ({ width: width - 4, height: height - 4 })),
			shareReplay(1)
		)

		// pass to $scope
		$scope.viz = {
			getSheetProps$,
			getGridSize$,
		}

		// listen for sheet invalidations
		sheetObj$.subscribe(sheetObj =>
			sheetObj.Invalidated.bind(function() {
				sheetObjInvalidation$.next()
			})
		)

		/** get sheet props */
		const sheetProps$ = merge(getSheetProps$, sheetObjInvalidation$).pipe(
			withLatestFrom(sheetObj$),
			switchMap(([_, sheetObj]) => from(sheetObj.getProperties())),
			shareReplay(1)
		)

		/** get objects on sheet */
		const sheetObjects$ = sheetProps$.pipe(
			delay(1),
			map(sheetProps =>
				sheetProps.cells.map(cell => ({ id: cell.name, el: document.querySelector(`[tid="${cell.name}"]`) }))
			),
			shareReplay(1)
		)

		/** layer object z-index based on order */
		sheetObjects$.subscribe(objects => {
			objects.forEach(({ el }, i) => {
				el.style.zIndex = i + 1
			})
		})

		/** document click listener */
		const documentClick$ = fromEvent(document, "click").pipe(
			map(evt => ({ target: evt.target, shiftKey: evt.shiftKey }))
		)

		const selectObject$ = new Subject()
		const clearSelectedObjects$ = new Subject()

		const selectedObjects$ = merge(selectObject$, clearSelectedObjects$).pipe(
			scan((acc, { type, payload }) => {
				switch (type) {
					case "CLEAR_SELECTED_OBJECTS":
						return []

					case "SELECT_OBJECT":
						const { object, shiftKey } = payload
						if (shiftKey) {
							if (acc.includes(object.id)) {
								const objectIndex = acc.indexOf(object.id)
								return [...acc.slice(0, objectIndex), ...acc.slice(objectIndex + 1)]
							} else return [...acc, object.id]
						} else return [object.id]

					default:
						return acc
				}
			}, []),
			shareReplay(1)
		)

		documentClick$.pipe(withLatestFrom(sheetObjects$)).subscribe(([{ target, shiftKey }, sheetObjects]) => {
			const clickedObject = sheetObjects.find(({ el }) => el.contains(target))
			if (clickedObject) selectObject$.next({ type: "SELECT_OBJECT", payload: { object: clickedObject, shiftKey } })
			else if (shiftKey === false) clearSelectedObjects$.next({ type: "CLEAR_SELECTED_OBJECTS" })
		})

		/** when selected objects updates.. */
		selectedObjects$.pipe(withLatestFrom(sheetObjects$)).subscribe(([selectedObjects, sheetObjects]) => {
			/** for each seet object.. */
			sheetObjects.forEach(({ id, el }) => {
				// if object is selected, add selected class
				if (selectedObjects.includes(id)) el.classList.add("dev-suite__selected")
				// else remove class
				else el.classList.remove("dev-suite__selected")

				el.classList.remove("active")
			})
		})

		/** listen from keydown on document */
		const documentKeyDown$ = fromEvent(document, "keydown").pipe(shareReplay(1))

		/** arrow keypress */
		const documentArrowKey$ = documentKeyDown$.pipe(
			/** filter anything that's not an arrow key */
			filter(evt => [37, 38, 39, 40].includes(evt.keyCode)),
			/** get current grid size */
			withLatestFrom(gridSize$),
			/** map to intended move direction amount */
			map(([evt, { width, height }]) => {
				/** convert 1 pixel to a percentage of sheet dimension */
				const pixelWidthAsAPercent = (1 / width) * 100
				const pixelHeightAsAPercent = (1 / height) * 100

				/** use shift key to multiply shift amount by 10 */
				const { shiftKey } = evt

				switch (evt.keyCode) {
					// left
					case 37:
						return { direction: "x", shift: shiftKey ? -10 * pixelWidthAsAPercent : -pixelWidthAsAPercent }
					// up
					case 38:
						return { direction: "y", shift: shiftKey ? -10 * pixelHeightAsAPercent : -pixelHeightAsAPercent }
					// right
					case 39:
						return { direction: "x", shift: shiftKey ? 10 * pixelWidthAsAPercent : pixelWidthAsAPercent }
					// down
					case 40:
						return { direction: "y", shift: shiftKey ? 10 * pixelHeightAsAPercent : pixelHeightAsAPercent }
				}
			})
		)

		/** on arrow press */
		const shiftUpdate$ = documentArrowKey$.pipe(
			/** get sheet props and selected objects */
			withLatestFrom(sheetProps$, selectedObjects$),
			/** map cell position properties to new values */
			map(([{ direction, shift }, sheetProps, selectedObjects]) => ({
				sheetProps,
				/** map all cells */
				updateCells: sheetProps.cells.map(cell => {
					// if cell is selected..
					if (selectedObjects.includes(cell.name)) {
						// return cell props with updated bound position
						return {
							...cell,
							bounds: { ...cell.bounds, [direction]: cell.bounds[direction] + shift },
							// col, row, colspan, and rowspan are set to undefined so qlik does not snap them to grid
							col: undefined,
							row: undefined,
							colspan: undefined,
							rowspan: undefined,
						}
					}
					// else return cell as is
					else return cell
				}),
			})),
			/** combine updated props */
			map(({ sheetProps, updateCells }) => ({ ...sheetProps, cells: updateCells }))
		)

		/** on new shift props.. */
		shiftUpdate$.pipe(withLatestFrom(sheetObj$)).subscribe(([updateProps, sheetObj]) => {
			/** update sheet obj properties */
			sheetObj.setProperties(updateProps)
		})

		/** delete */
		documentKeyDown$
			.pipe(
				/** filter anything that's not delete */
				filter(evt => evt.keyCode === 8),
				/** get sheet object */
				withLatestFrom(sheetObj$),
				/** get sheet full property tree */
				switchMap(([_, sheetObj]) =>
					from(sheetObj.getFullPropertyTree().then(propertyTree => ({ propertyTree, sheetObj })))
				),
				/** get all selected objects */
				withLatestFrom(selectedObjects$),
				/** stop if no objects are selected */
				filter(([_propertyTree, selectedObjects]) => selectedObjects.length > 0),
				/** extract the selected objects from the property tree qChildren and qProperty.cells */
				map(([{ propertyTree, sheetObj }, selectedObjects]) => ({
					propertyTree,
					updatedQChildren: propertyTree.qChildren.filter(
						qChild => !selectedObjects.includes(qChild.qProperty.qInfo.qId)
					),
					updatedCells: propertyTree.qProperty.cells.filter(cell => !selectedObjects.includes(cell.name)),
					sheetObj,
				})),
				/** set full property tree with updated qChildren and qProperty.cells */
				switchMap(({ propertyTree, updatedQChildren, updatedCells, sheetObj }) =>
					from(
						sheetObj.setFullPropertyTree({
							...propertyTree,
							qProperty: { ...propertyTree.qProperty, cells: updatedCells },
							qChildren: updatedQChildren,
						})
					)
				)
			)
			.subscribe()

		/** drag subjects */
		const objectDragging$ = new Subject()
		const objectDragStart$ = new Subject()
		const objectDragEnd$ = new Subject()
		const isDragging$ = new BehaviorSubject(false)

		sheetObjects$.subscribe(objects => {
			objects.forEach(object => {
				select(object.el).on("mousedown.drag", () => {
					const { x, y, width, height } = object.el.getBoundingClientRect()
					objectDragStart$.next({
						startObjectX: x,
						startObjectY: y,
						objectWidth: width,
						objectHeight: height,
						startClientX: event.clientX,
						startClientY: event.clientY,
					})

					select(event.view)
						.on(
							"mousemove.drag",
							() => {
								noevent()
								objectDragging$.next({ object, clientX: event.clientX, clientY: event.clientY })
							},
							true
						)
						.on(
							"mouseup.drag",
							() => {
								objectDragEnd$.next({ startObjectX: x, startObjectY: y, event, object })
								select(event.view).on("mousemove.drag mouseup.drag", null)
							},
							true
						)
				})
			})
		})

		objectDragStart$
			.pipe(
				switchMap(({ startObjectX, startObjectY, objectWidth, objectHeight }) =>
					objectDragging$.pipe(
						tap(() => isDragging$.next(true)),
						tap(() => {
							select("body")
								.append("div")
								.attr("class", "dev-suite__shadow-element")
								.style("width", `${objectWidth}px`)
								.style("height", `${objectHeight}px`)
								.style("left", `${startObjectX}px`)
								.style("top", `${startObjectY}px`)
						}),
						take(1)
					)
				)
			)
			.subscribe()

		const dragDelta$ = objectDragging$.pipe(
			withLatestFrom(objectDragStart$),
			map(([{ object, clientX, clientY }, { startObjectX, startObjectY, startClientX, startClientY }]) => ({
				x: clientX - startClientX,
				y: clientY - startClientY,
				startObjectX,
				startObjectY,
				object,
			})),
			shareReplay(1)
		)

		dragDelta$.subscribe(({ x, y, startObjectX, startObjectY }) => {
			select(".dev-suite__shadow-element")
				.style("left", `${startObjectX + x}px`)
				.style("top", `${startObjectY + y}px`)
		})

		const objectDragNewPos$ = objectDragEnd$.pipe(
			withLatestFrom(isDragging$, sheetObjects$),
			filter(([_, isDragging]) => isDragging),
			tap(([{ event, object }, _isDragging, sheetObjects]) => {
				const { shiftKey } = event
				const clickedObject = sheetObjects.find(({ id }) => object.id === id)
				if (clickedObject) selectObject$.next({ type: "SELECT_OBJECT", payload: { object: clickedObject, shiftKey } })
				else if (shiftKey === false) clearSelectedObjects$.next({ type: "CLEAR_SELECTED_OBJECTS" })

				selectAll(".dev-suite__shadow-element").remove()
			}),
			tap(() => isDragging$.next(false)),
			withLatestFrom(dragDelta$, gridSize$),
			map(([_, { object, x, y }, { width: gridWidth, height: gridHeight }]) => {
				const xDeltaAsAPercent = (x / gridWidth) * 100
				const yDeltaAsAPercent = (y / gridHeight) * 100
				return { object, xDeltaAsAPercent, yDeltaAsAPercent }
			})
		)

		/** calculate new property for sheet */
		const objectDragNewProps$ = objectDragNewPos$.pipe(
			/** with sheetProps$ */
			withLatestFrom(sheetProps$),
			/** create new prop object */
			map(([{ object, xDeltaAsAPercent, yDeltaAsAPercent }, sheetProps]) => {
				/** map prop cells */
				const updateCells = sheetProps.cells.map(cell => {
					/** if cell is the object dragged */
					if (cell.name === object.id) {
						/** update bounds to new delta position */
						return {
							...cell,
							bounds: { ...cell.bounds, x: cell.bounds.x + xDeltaAsAPercent, y: cell.bounds.y + yDeltaAsAPercent },
							col: undefined,
							row: undefined,
							colspan: undefined,
							rowspan: undefined,
						}
					}
					// else return cell
					else return cell
				})

				const movedObjectIndex = updateCells.findIndex(cell => cell.name === object.id)
				const movedObject = updateCells[movedObjectIndex]
				const resortedCells = [
					...updateCells.slice(0, movedObjectIndex),
					...updateCells.slice(movedObjectIndex + 1),
					movedObject,
				]

				return { ...sheetProps, cells: resortedCells }
			})
		)

		/** with new sheet props, set properties */
		objectDragNewProps$.pipe(withLatestFrom(sheetObj$)).subscribe(([newProps, sheetObj]) => {
			sheetObj.setProperties(newProps).then(() => sheetObj.getLayout())
		})
	},
]
