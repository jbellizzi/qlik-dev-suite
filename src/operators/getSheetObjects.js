import { Observable } from "rxjs"
import { delay, map } from "rxjs/operators"

export default () => source =>
	new Observable(observer =>
		source
			.pipe(
				delay(1),
				/** find objects by tid */
				map(sheetProps =>
					sheetProps.cells.map(cell => ({ id: cell.name, el: document.querySelector(`[tid="${cell.name}"]`) }))
				)
			)
			.subscribe({
				next(objects) {
					observer.next(objects)
				},
				error(err) {
					observer.error(err)
				},
				complete() {
					observer.complete()
				},
			})
	)