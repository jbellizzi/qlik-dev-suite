import { select } from "d3-selection"
import { Observable } from "rxjs"
import { switchMap, take, tap } from "rxjs/operators"

export default (objectDragging$, isDragging$) => source =>
	new Observable(observer =>
		source
			.pipe(
				switchMap(({ startObjectX, startObjectY, objectWidth, objectHeight }) =>
					objectDragging$.pipe(
						tap(() => isDragging$.next(true)),
						tap(() => {
							select("body")
								.append("div")
								.attr("class", "dev-suite__shadow-element")
								.style("width", `${objectWidth}px`)
								.style("height", `${objectHeight}px`)
								.style("left", `${startObjectX}px`)
								.style("top", `${startObjectY}px`)
						}),
						take(1)
					)
				)
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
