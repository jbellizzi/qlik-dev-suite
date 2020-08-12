import { select } from "d3-selection"
import { drag } from "d3-drag"
import { Subject, from, BehaviorSubject, merge, fromEvent } from "rxjs"
import { withLatestFrom, switchMap, startWith, tap, shareReplay, map, scan, filter } from "rxjs/operators"

export default qlik => [
	"$scope",
	"$element",
	function($scope, $element) {
		const currentSheetId = qlik.navigation.getCurrentSheetId().sheetId
		const app = $scope.ext.model.enigmaModel.app

		const sheetObj$ = from(app.getObject(currentSheetId)).pipe(shareReplay(1))
		const sheetObjInvalidation$ = new Subject()
		const getSheetProps$ = new Subject()

		$scope.viz = {
			getSheetProps$,
		}

		sheetObj$.subscribe(sheetObj =>
			sheetObj.Invalidated.bind(function() {
				sheetObjInvalidation$.next()
			})
		)

		const sheetProps$ = merge(getSheetProps$, sheetObjInvalidation$).pipe(
			withLatestFrom(sheetObj$),
			switchMap(([_, sheetObj]) => from(sheetObj.getProperties())),
			shareReplay(1)
		)

		const sheetObjects$ = sheetProps$.pipe(
			map(sheetProps =>
				sheetProps.cells.map(cell => ({ id: cell.name, el: document.querySelector(`[tid="${cell.name}"]`) }))
			),
			shareReplay(1)
		)

		const documentClick$ = fromEvent(document, "click").pipe(
			map(evt => ({ target: evt.target, shiftKey: evt.shiftKey }))
		)

		// sheetProps$.subscribe(console.log)

		// sheetObjects$.subscribe(console.log)

		// documentClick$.subscribe(console.log)

		const selectedObjects$ = documentClick$.pipe(
			withLatestFrom(sheetObjects$),
			map(([{ target, shiftKey }, sheetObjects]) => {
				return {
					clickedObject: sheetObjects.filter(({ el }) => el.contains(target)),
					shiftKey,
					sheetObjects,
				}
			}),
			scan((acc, { clickedObject, shiftKey, sheetObjects }) => {
				if (clickedObject.length > 0) {
					if (shiftKey) {
						if (acc.includes(clickedObject[0].id)) {
							const objectIndex = acc.indexOf(clickedObject[0].id)
							return [...acc.slice(0, objectIndex), ...acc.slice(objectIndex + 1)]
						} else return [...acc, clickedObject[0].id]
					} else return [clickedObject[0].id]
				} else {
					if (shiftKey) return acc
					else return []
				}
			}, []),
			shareReplay(1)
		)

		selectedObjects$.pipe(withLatestFrom(sheetObjects$)).subscribe(([selectedObjects, sheetObjects]) => {
			sheetObjects.forEach(({ id, el }) => {
				if (selectedObjects.includes(id)) el.classList.add("dev-suite__selected")
				else el.classList.remove("dev-suite__selected")
			})
		})

		const documentArrowKey$ = fromEvent(document, "keydown").pipe(
			filter(evt => [37, 38, 39, 40].includes(evt.keyCode)),
			map(evt => {
				const { shiftKey } = evt
				switch (evt.keyCode) {
					case 37:
						return { direction: "x", shift: shiftKey ? -10 : -1 }
					case 38:
						return { direction: "y", shift: shiftKey ? -10 : -1 }
					case 39:
						return { direction: "x", shift: shiftKey ? 10 : 1 }
					case 40:
						return { direction: "y", shift: shiftKey ? 10 : 1 }
				}
			})
		)

		const shiftUpdate$ = documentArrowKey$.pipe(
			withLatestFrom(sheetProps$, selectedObjects$),
			map(([{ direction, shift }, sheetProps, selectedObjects]) => ({
				sheetProps,
				updateCells: sheetProps.cells.map(cell => {
					if (selectedObjects.includes(cell.name)) {
						return {
							...cell,
							bounds: { ...cell.bounds, [direction]: cell.bounds[direction] + shift },
							col: undefined,
							row: undefined,
							colspan: undefined,
							rowspan: undefined,
						}
					} else return cell
				}),
			})),
			map(({ sheetProps, updateCells }) => ({ ...sheetProps, cells: updateCells }))
		)

		shiftUpdate$.pipe(withLatestFrom(sheetObj$)).subscribe(([updateProps, sheetObj]) => {
			sheetObj.setProperties(updateProps)
		})

		// const currentSheet = qlik.navigation.getCurrentSheetId().sheetId
		// // ..controller code here
		// const model = $scope.ext.model.enigmaModel
		// const app = $scope.ext.model.enigmaModel.app
		// const sheetObject = app.getObject(currentSheet)
		// const sheetLayout = sheetObject.then(sheet => sheet.getLayout())
		// const sheetObjects = sheetLayout.then(layout => layout.qChildList.qItems.map(item => item.qInfo.qId))
		// const objectElements = sheetObjects.then(objectIds =>
		// 	objectIds.map(id => ({
		// 		el: document.querySelector(`[tid="${id}"]`),
		// 		id,
		// 	}))
		// )
		// let selectedObjects = []
		// objectElements.then(objects => {
		// 	objects.forEach(({ el }) => {
		// 		select(el).call(
		// 			drag()
		// 				.on("start", () => console.log("started"))
		// 				.on("drag", () => console.log("draggind"))
		// 				.on("end", () => console.log("ended"))
		// 		)
		// 	})
		// 	document.addEventListener("click", evt => {
		// 		const { shiftKey } = evt
		// 		let clickedObject = undefined
		// 		objects.forEach(({ el, id }) => {
		// 			if (el.contains(evt.target)) {
		// 				clickedObject = { el, id }
		// 			}
		// 		})
		// 		if (clickedObject) {
		// 			if (shiftKey) {
		// 				if (selectedObjects.includes(clickedObject.id)) {
		// 					const idIndex = selectedObjects.indexOf(clickedObject.id)
		// 					selectedObjects = [...selectedObjects.slice(0, idIndex), ...selectedObjects.slice(idIndex + 1)]
		// 				} else {
		// 					selectedObjects.push(clickedObject.id)
		// 				}
		// 			} else {
		// 				selectedObjects = [clickedObject.id]
		// 			}
		// 		} else {
		// 			if (shiftKey === false) {
		// 				selectedObjects = []
		// 			}
		// 		}
		// 		objects.forEach(({ el, id }) => {
		// 			if (selectedObjects.includes(id)) el.classList.add("dev-suite__selected")
		// 			else el.classList.remove("dev-suite__selected")
		// 		})
		// 	})
		// })
		// const keyCodes = {
		// 	37: { direction: "left", type: "col", position: -1 },
		// 	38: { direction: "up", type: "row", position: -1 },
		// 	39: { direction: "right", type: "col", position: 1 },
		// 	40: { direction: "down", type: "row", position: 1 },
		// }
		// document.addEventListener("keydown", evt => {
		// 	if ([37, 38, 39, 40].includes(evt.keyCode)) {
		// 		sheetObject
		// 			.then(sheet => sheet.getProperties())
		// 			.then(props => {
		// 				console.log(props)
		// 				const newCells = props.cells.map(cell => {
		// 					if (selectedObjects.includes(cell.name)) {
		// 						return {
		// 							...cell,
		// 							// [keyCodes[evt.keyCode].type]: cell[keyCodes[evt.keyCode].type] + keyCodes[evt.keyCode].position,
		// 							// bounds: undefined,
		// 							bounds: { x: (3 / 48) * 100, y: 0, width: 50, height: 50 },
		// 							col: undefined,
		// 							row: undefined,
		// 							colspan: undefined,
		// 							rowspan: undefined,
		// 						}
		// 					} else return cell
		// 				})
		// 				return {
		// 					...props,
		// 					cells: newCells,
		// 				}
		// 			})
		// 			.then(newProps => {
		// 				return sheetObject.then(sheet => sheet.setProperties(newProps))
		// 			})
		// 	}
		// })
	},
]
