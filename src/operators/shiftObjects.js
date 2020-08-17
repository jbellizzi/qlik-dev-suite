import { Observable } from "rxjs"
import { map, withLatestFrom } from "rxjs/operators"

export default sheetProps$ => source =>
	new Observable(observer =>
		source
			.pipe(
				/** with sheetProps */
				withLatestFrom(sheetProps$),
				/** map to new props */
				map(([objectsToMove, sheetProps]) => {
					return {
						...sheetProps,
						/** map all cells */
						cells: sheetProps.cells.map(cell => {
							/** find object to move */
							const objectToMove = objectsToMove.find(({ id }) => id === cell.name)
							/** if found, calculate new x and y bounds from delta */
							if (objectToMove) {
								const { delta } = objectToMove
								return {
									...cell,
									bounds: {
										...cell.bounds,
										...(delta.x ? { x: cell.bounds.x + delta.x } : {}),
										...(delta.y ? { y: cell.bounds.y + delta.y } : {}),
									},
									/** remove col and row properties to remove grid snapping */
									col: undefined,
									row: undefined,
									colspan: undefined,
									rowspan: undefined,
								}
							}
							// else, return cell as is
							else return cell
						}),
					}
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
