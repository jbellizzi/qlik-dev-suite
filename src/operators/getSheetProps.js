import { from, Observable } from "rxjs"
import { shareReplay, switchMap, withLatestFrom } from "rxjs/operators"

export default obj$ => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(obj$),
				switchMap(([_, obj]) => from(obj.getProperties())),
				shareReplay(1)
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
