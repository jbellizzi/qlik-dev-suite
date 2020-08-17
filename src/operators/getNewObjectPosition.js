import { selectAll } from "d3-selection"
import { Observable } from "rxjs"
import { filter, map, tap, withLatestFrom } from "rxjs/operators"
import { actions } from "../util"

export default (
	isDragging$,
	sheetObjects$,
	dragDelta$,
	gridSize$,
	sheetProps$,
	selectObject,
	clearSelectedObjects
) => source =>
	new Observable(observer =>
		source
			.pipe(
				/** with isDragging and sheetObjects */
				withLatestFrom(isDragging$, sheetObjects$),
				/** stop if mouseup was not fired from a dragging event */
				filter(([_, isDragging]) => isDragging),
				/** add object to selected objects and remove shadow element */
				tap(([{ event, object }, _isDragging, sheetObjects]) => {
					/** get shift mode */
					const { shiftKey } = event
					/** find object being dragged */
					const clickedObject = sheetObjects.find(({ id }) => object.id === id)
					/** if found, select object */
					if (clickedObject)
						selectObject({ type: actions.SELECT_OBJECT, payload: { id: clickedObject.id, shiftMode: shiftKey } })
					/** else, clear selected objects */ else if (shiftKey === false)
						clearSelectedObjects({ type: actions.CLEAR_SELECTED_OBJECTS })

					/** remove shadow element */
					selectAll(".dev-suite__shadow-element").remove()
				}),
				/** set isDragging$ to false */
				tap(() => isDragging$.next(false)),
				/** with dragDelta and gridSize */
				withLatestFrom(dragDelta$, gridSize$),
				/** map deltas as sheet percent */
				map(([_, { object, x, y }, { width: gridWidth, height: gridHeight }]) => {
					/** calculate x and y delta positions as percent of sheet dimensions */
					const xDeltaAsAPercent = (x / gridWidth) * 100
					const yDeltaAsAPercent = (y / gridHeight) * 100
					return { object, xDeltaAsAPercent, yDeltaAsAPercent }
				}),
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

					/** find object that was just moved */
					const movedObjectIndex = updateCells.findIndex(cell => cell.name === object.id)
					const movedObject = updateCells[movedObjectIndex]
					/** place recently moved object at end of cells so it displays on top */
					const resortedCells = [
						...updateCells.slice(0, movedObjectIndex),
						...updateCells.slice(movedObjectIndex + 1),
						movedObject,
					]

					return { ...sheetProps, cells: resortedCells }
				})
			)
			.subscribe({
				next(props) {
					observer.next(props)
				},
				error(err) {
					observer.error(err)
				},
				complete() {
					observer.complete()
				},
			})
	)
