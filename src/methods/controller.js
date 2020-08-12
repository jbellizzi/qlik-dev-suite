import { select, selectAll, event } from "d3-selection"
import { drag } from "d3-drag"
import { Subject, from, BehaviorSubject, merge, fromEvent, of } from "rxjs"
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
} from "rxjs/operators"

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
		const gridSize$ = getGridSize$.pipe(map(({ width, height }) => ({ width: width - 4, height: height - 4 })))

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
			delay(250),
			map(sheetProps =>
				sheetProps.cells.map(cell => ({ id: cell.name, el: document.querySelector(`[tid="${cell.name}"]`) }))
			),
			shareReplay(1)
		)

		/** document click listener */
		const documentClick$ = fromEvent(document, "click").pipe(
			map(evt => ({ target: evt.target, shiftKey: evt.shiftKey }))
		)

		/** store selected objects state */
		const selectedObjects$ = documentClick$.pipe(
			/** with all objects in sheet */
			withLatestFrom(sheetObjects$),
			/** identify object that was clicked */
			map(([{ target, shiftKey }, sheetObjects]) => {
				return {
					clickedObject: sheetObjects.filter(({ el }) => el.contains(target)),
					shiftKey,
					sheetObjects,
				}
			}),
			/** update state */
			scan((acc, { clickedObject, shiftKey, sheetObjects }) => {
				/** if an object was clicked.. */
				if (clickedObject.length > 0) {
					/** if holding shift key */
					if (shiftKey) {
						/** if object was already selected, deselect */
						if (acc.includes(clickedObject[0].id)) {
							const objectIndex = acc.indexOf(clickedObject[0].id)
							return [...acc.slice(0, objectIndex), ...acc.slice(objectIndex + 1)]
						}
						// else, add/keep object
						else return [...acc, clickedObject[0].id]
					}
					// if not holding shift key, make only this object selected
					else return [clickedObject[0].id]
				}
				// if an object wasn't clicked..
				else {
					// if holding shift key, keep prev state
					if (shiftKey) return acc
					// else deselect all objects
					else return []
				}
			}, []),
			shareReplay(1)
		)

		/** when selected objects updates.. */
		selectedObjects$.pipe(withLatestFrom(sheetObjects$)).subscribe(([selectedObjects, sheetObjects]) => {
			/** for each seet object.. */
			sheetObjects.forEach(({ id, el }) => {
				// if object is selected, add selected class
				if (selectedObjects.includes(id)) el.classList.add("dev-suite__selected")
				// else remove class
				else el.classList.remove("dev-suite__selected")
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

		const objectMouseDown$ = new Subject()
		// .pipe(shareReplay(1))
		const objectMouseMove$ = new Subject()
		// .pipe(shareReplay(1))
		const objectMouseUp$ = new Subject()
		// .pipe(shareReplay(1))
		const dragged$ = new BehaviorSubject(false)

		sheetObjects$.subscribe(objects => {
			objects.forEach(object => {
				// select(el).on("mousedown.drag", null)
				select(object.el).call(
					drag()
						.on("start", () =>
							objectMouseDown$.next({ object, clientX: event.sourceEvent.clientX, clientY: event.sourceEvent.clientY })
						)
						.on("drag", () =>
							objectMouseMove$.next({ object, clientX: event.sourceEvent.clientX, clientY: event.sourceEvent.clientY })
						)
						.on("end", () =>
							objectMouseUp$.next({ object, clientX: event.sourceEvent.clientX, clientY: event.sourceEvent.clientY })
						)
				)
			})
		})
		// const mouseDown$ = fromEvent(document, "mousedown")
		// const mouseMove$ = fromEvent(document, "mousemove")
		// const mouseUp$ = fromEvent(document, "mouseup")

		objectMouseDown$
			.pipe(
				switchMap(() =>
					objectMouseMove$.pipe(
						tap(({ object }) => {
							const { x, y, width, height } = object.el.getBoundingClientRect()
							select("body")
								.append("div")
								.attr("class", "dev-suite__shadow-element")
								.style("width", `${width}px`)
								.style("height", `${height}px`)
								.style("left", `${x}px`)
								.style("top", `${y}px`)
						}),
						take(1)
					)
				)
			)
			.subscribe()

		const dragDelta$ = objectMouseDown$.pipe(
			map(({ clientX, clientY, object }) => {
				const { x, y } = object.el.getBoundingClientRect()
				return { startObjectX: x, startObjectY: y, clientX, clientY }
			}),
			switchMap(({ startObjectX, startObjectY, clientX: startClientX, clientY: startClientY }) =>
				objectMouseMove$.pipe(
					tap(() => dragged$.next(true)),
					map(({ object, clientX, clientY }) => ({
						x: clientX - startClientX,
						y: clientY - startClientY,
						startObjectX,
						startObjectY,
						object,
					})),
					takeUntil(objectMouseUp$)
				)
			)
		)

		dragDelta$.subscribe(({ object, x, y, startObjectX, startObjectY }) => {
			select(".dev-suite__shadow-element")
				.style("left", `${startObjectX + x}px`)
				.style("top", `${startObjectY + y}px`)
		})

		const objectDragNewPos$ = objectMouseUp$.pipe(
			withLatestFrom(dragged$),
			filter(([_, dragged]) => dragged),
			tap(() => selectAll(".dev-suite__shadow-element").remove()),
			tap(() => dragged$.next(false)),
			withLatestFrom(dragDelta$, gridSize$),
			map(([_, { object, x, y }, { width: gridWidth, height: gridHeight }]) => {
				const xDeltaAsAPercent = (x / gridWidth) * 100
				const yDeltaAsAPercent = (y / gridHeight) * 100
				return { object, xDeltaAsAPercent, yDeltaAsAPercent }
			})
		)

		const objectDragNewProps$ = objectDragNewPos$.pipe(
			withLatestFrom(sheetProps$),
			map(([{ object, xDeltaAsAPercent, yDeltaAsAPercent }, sheetProps]) => {
				// const updateCell = sheetProps.cells.find(cell => cell.name === object.id)
				const updateCells = sheetProps.cells.map(cell => {
					if (cell.name === object.id) {
						return {
							...cell,
							bounds: { ...cell.bounds, x: cell.bounds.x + xDeltaAsAPercent, y: cell.bounds.y + yDeltaAsAPercent },
							col: undefined,
							row: undefined,
							colspan: undefined,
							rowspan: undefined,
						}
					} else return cell
				})

				return { ...sheetProps, cells: updateCells }
			})
		)

		objectDragNewProps$.pipe(withLatestFrom(sheetObj$)).subscribe(([newProps, sheetObj]) => {
			sheetObj.setProperties(newProps)
		})
		// objectDragNewPos$.pipe(
		// 	withLatestFrom
		// )
		// .pipe(withLatestFrom(sheetObj$, dragDelta$, gridSize$))
		// .subscribe(([_, sheetObj, { object, x, y, startObjectX, startObjectY }, { width: gridWidth, height: gridHeight }]) => {
		// 	console.log(x, startObjectX)
		// 	const deltaX = x - startObjectX
		// 	const deltaY = y - startObjectY

		// 	const { x: objectStartX, y: objectStartY } = object.el.getBoundingClientRect()

		// 	const pixelWidthAsAPercent = ((objectStartX + deltaX) / gridWidth) * 100
		// 	const pixelHeightAsAPercent = ((objectStartY = deltaY) / gridHeight) * 100

		// 	selectAll(".dev-suite__shadow-element").remove()
		// })

		// drag$.subscribe(evt => {
		// 	// document.querySelector("#grid").classList.remove("dragging")
		// 	console.log(evt)
		// })
		// .pipe(
		// 	withLatestFrom(sheetObjects$),
		// 	map(([{ target }]))
		// )
		// sheetObjects$
		// 	.pipe(
		// 		scan((acc, objects) => {
		// 			const newRegister = objects.filter(object => !acc.includes(object.el)).map(object => object.el)
		// 			newRegister.forEach(objectEl => {
		// 				select(objectEl).call(
		// 					drag()
		// 						.on("start", () => {
		// 							const { x, y, width, height } = objectEl.getBoundingClientRect()
		// 							select("body")
		// 								.append("div")
		// 								.attr("class", "dev-suite__shadow-element")
		// 								.style("width", `${width}px`)
		// 								.style("height", `${height}px`)
		// 								.style("left", `${x}px`)
		// 								.style("top", `${y}px`)
		// 						})
		// 						.on("drag", () => {
		// 							console.log(event.x, event.y)
		// 							select(".dev-suite__shadow-element")
		// 								.style("left", `${event.x}px`)
		// 								.style("top", `${event.y}px`)
		// 						})
		// 						.on("end", () => {
		// 							selectAll(".dev-suite__shadow-element").remove()
		// 						})
		// 				)
		// 			})
		// 			return [...acc, ...newRegister]
		// 		}, [])
		// 	)
		// 	.subscribe()
	},
]
