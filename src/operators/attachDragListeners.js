import { select, event } from "d3-selection"
import { Observable } from "rxjs"
import { tap } from "rxjs/operators"

export default (dragStart$, dragging$, dragEnd$) => source =>
	new Observable(observer =>
		source
			.pipe(
				tap(objects => {
					objects.forEach(object => {
						select(object.el).on("mousedown.drag", () => {
							const { x, y, width, height } = object.el.getBoundingClientRect()
							dragStart$.next({
								startObjectX: x,
								startObjectY: y,
								objectWidth: width,
								objectHeight: height,
								startClientX: event.clientX,
								startClientY: event.clientY,
							})

							select(event.view)
								.on(
									"mousemove.drag",
									() => {
										event.preventDefault()
										event.stopImmediatePropagation()
										dragging$.next({ object, clientX: event.clientX, clientY: event.clientY })
									},
									true
								)
								.on(
									"mouseup.drag",
									() => {
										dragEnd$.next({ startObjectX: x, startObjectY: y, event, object })
										select(event.view).on("mousemove.drag mouseup.drag", null)
									},
									true
								)
						})
					})
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
