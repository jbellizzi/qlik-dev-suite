import { Observable } from "rxjs"
import { map, withLatestFrom } from "rxjs/operators"

export default objectDragStart$ => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(objectDragStart$),
				map(([{ object, clientX, clientY }, { startObjectX, startObjectY, startClientX, startClientY }]) => ({
					x: clientX - startClientX,
					y: clientY - startClientY,
					startObjectX,
					startObjectY,
					object,
				}))
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
