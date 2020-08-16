import { Observable } from "rxjs"
import { filter, pluck, withLatestFrom, tap } from "rxjs/operators"

export default inEditMode$ => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(inEditMode$),
				filter(([_, inEditMode]) => inEditMode),
				pluck(0)
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
