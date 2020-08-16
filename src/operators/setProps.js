import { Observable, from } from "rxjs"
import { switchMap, withLatestFrom } from "rxjs/operators"

export default obj$ => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(obj$),
				switchMap(([props, obj]) => {
					return from(obj.setProperties(props))
				})
			)
			.subscribe({
				next(status) {
					observer.next(status)
				},
				error(err) {
					observer.error(err)
				},
				complete() {
					observer.complete()
				},
			})
	)
