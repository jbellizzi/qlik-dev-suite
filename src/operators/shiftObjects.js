import { Observable } from "rxjs"
import { map, tap, withLatestFrom } from "rxjs/operators"

export default sheetProps$ => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(sheetProps$),
				map(([objectsToMove, sheetProps]) => {
					return {
						...sheetProps,
						cells: sheetProps.cells.map(cell => {
							const objectToMove = objectsToMove.find(({ id }) => id === cell.name)
							if (objectToMove) {
								const { delta } = objectToMove
								return {
									...cell,
									bounds: {
										...cell.bounds,
										...(delta.x ? { x: cell.bounds.x + delta.x } : {}),
										...(delta.y ? { y: cell.bounds.y + delta.y } : {}),
									},
									col: undefined,
									row: undefined,
									colspan: undefined,
									rowspan: undefined,
								}
							} else return cell
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
