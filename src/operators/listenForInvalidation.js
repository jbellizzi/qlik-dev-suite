import { Observable } from "rxjs"

export default () => source =>
	new Observable(observer =>
		source.subscribe({
			next(obj) {
				obj.Invalidated.bind(function() {
					observer.next()
				})
			},
			error(err) {
				observer.error(err)
			},
			complete() {
				observer.complete()
			},
		})
	)
