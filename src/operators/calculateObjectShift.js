import { Observable } from "rxjs"
import { map, withLatestFrom } from "rxjs/operators"

export default gridSize$ => source =>
	new Observable(observer =>
		source
			.pipe(
				/** with grid size */
				withLatestFrom(gridSize$),
				/** map to shift direction and amount */
				map(([{ key, shiftMode }, { width: gridWidth, height: gridHeight }]) => {
					/** calculate width and height pixel change as a percentage of grid dimensions */
					const pixelWidthAsPercent = (1 / gridWidth) * 100 * (shiftMode ? 10 : 1)
					const pixelHeightAsPercent = (1 / gridHeight) * 100 * (shiftMode ? 10 : 1)

					/** map to appropriate direction */
					switch (key) {
						case "left":
							return { direction: "x", shift: -pixelWidthAsPercent }
						case "up":
							return { direction: "y", shift: -pixelHeightAsPercent }
						case "right":
							return { direction: "x", shift: pixelWidthAsPercent }
						case "down":
							return { direction: "y", shift: pixelHeightAsPercent }
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
