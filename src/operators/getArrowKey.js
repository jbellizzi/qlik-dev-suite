import { Observable } from "rxjs"
import { map, filter } from "rxjs/operators"

export default () => source =>
	new Observable(observer =>
		source
			.pipe(
				filter(evt => [37, 38, 39, 40].includes(evt.keyCode)),
				map(({ keyCode, shiftKey }) => {
					switch (keyCode) {
						case 37:
							return { key: "left", shiftMode: shiftKey }
						case 38:
							return { key: "up", shiftMode: shiftKey }
						case 39:
							return { key: "right", shiftMode: shiftKey }
						case 40:
							return { key: "down", shiftMode: shiftKey }
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
