import { select, event } from "d3-selection"
import { Observable } from "rxjs"
import { tap } from "rxjs/operators"

export default (dragStart$, dragging$, dragEnd$) => source =>
	new Observable(observer =>
		source
			.pipe(
				/** sheet objects */
				tap(objects => {
					/** for each object.. */
					objects.forEach(object => {
						/** select object and add mousedown listener */
						select(object.el)
							.select(".object-and-panel-wrapper")
							.on("mousedown.drag", () => {
								/** get object position and dimensions */
								const { x, y, width, height } = object.el.getBoundingClientRect()
								/** pass to dragStart$ */
								dragStart$.next({
									startObjectX: x,
									startObjectY: y,
									objectWidth: width,
									objectHeight: height,
									startClientX: event.clientX,
									startClientY: event.clientY,
								})

								/** select window */
								select(event.view)
									/** override mousemove listener */
									.on(
										"mousemove.drag",
										() => {
											/** prevent other mousemove listeners from firing */
											event.preventDefault()
											event.stopImmediatePropagation()
											/** pass movement to dragging$ */
											if (object.type !== "dev-suite") {
												dragging$.next({ object, clientX: event.clientX, clientY: event.clientY })
											}
										},
										true
									)
									/** override mouseup lisener */
									.on(
										"mouseup.drag",
										() => {
											/** pass to dragEnd$ */
											dragEnd$.next({ startObjectX: x, startObjectY: y, event, object })
											/** reset window mousemove and mouseup liseners */
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
