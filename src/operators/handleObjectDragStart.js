import { select } from "d3-selection"
import { Observable } from "rxjs"
import { switchMap, take, tap } from "rxjs/operators"

export default (objectDragging$, isDragging$) => source =>
	new Observable(observer =>
		source
			.pipe(
				/** take initial drag start props */
				switchMap(({ startObjectX, startObjectY, objectWidth, objectHeight }) =>
					/** for objectDragging$ stream outputs */
					objectDragging$.pipe(
						/** set isDragging$ to true */
						tap(() => isDragging$.next(true)),
						/** add the shadow element */
						tap(() => {
							select("body")
								.append("div")
								.attr("class", "dev-suite__shadow-element")
								.style("width", `${objectWidth}px`)
								.style("height", `${objectHeight}px`)
								.style("left", `${startObjectX}px`)
								.style("top", `${startObjectY}px`)
						}),
						/** only run once for each dragStart */
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
