import { select, event } from "d3-selection"
import { Observable } from "rxjs"
import { tap, withLatestFrom } from "rxjs/operators"

export default (dragStart$, dragging$, dragEnd$, toggleMode$, gridSize$, sheetProps$) => source =>
	new Observable(observer =>
		source
			.pipe(
				withLatestFrom(toggleMode$, gridSize$, sheetProps$),
				/** sheet objects */
				tap(
					([
						objects,
						toggleMode,
						{ width: gridWidth, height: gridHeight, columns: gridColumns, rows: gridRows },
						sheetProps,
					]) => {
						/** for each object.. */
						objects.forEach(object => {
							/** select object and add mousedown listener */
							select(object.el)
								.select(".object-and-panel-wrapper")
								.on("mousedown.drag", () => {
									let xShift = 0,
										yShift = 0
									if (toggleMode === "grid") {
										const objBounds = sheetProps.cells.find(cell => cell.name === object.id).bounds
										const col = Math.round((objBounds.x / 100) * gridColumns)
										const colXPos = (col / gridColumns) * gridWidth
										const currXPos = (objBounds.x / 100) * gridWidth
										xShift = colXPos - currXPos

										const row = Math.round((objBounds.y / 100) * gridRows)
										const rowYPos = (row / gridRows) * gridHeight
										const currYPos = (objBounds.y / 100) * gridHeight
										yShift = rowYPos - currYPos
									}

									/** get object position and dimensions */
									const objRect = object.el.getBoundingClientRect()
									const { x, y, width, height } = objRect
									/** pass to dragStart$ */
									dragStart$.next({
										startObjectX: x + xShift,
										startObjectY: y + yShift,
										objectWidth: width,
										objectHeight: height,
										startClientX: event.clientX,
										startClientY: event.clientY,
										object,
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
					}
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
