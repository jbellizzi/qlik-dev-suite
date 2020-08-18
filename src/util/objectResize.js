import { event, select, selectAll } from "d3-selection"
import { Subject } from "rxjs"
import { takeUntil, tap, take, switchMap, withLatestFrom, map, filter } from "rxjs/operators"
import { inEditMode, setProps } from "../operators"
import selectObjects from "./selectObjects"

const resizePositions = ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-right", "bottom-left"]

export default (sheetObj$, sheetObjects$, gridSize$, sheetProps$, inEditMode$, destroy$) => {
	const objectResizeDragStart$ = new Subject().pipe(takeUntil(destroy$))
	const objectResizeDragging$ = new Subject().pipe(takeUntil(destroy$))
	const objectResizeDragEnd$ = new Subject().pipe(takeUntil(destroy$))
	const isResizing$ = new Subject().pipe(takeUntil(destroy$))

	sheetObjects$
		.pipe(
			inEditMode(inEditMode$),
			tap(objects => {
				objects.forEach(object => {
					const objectEl = select(object.el)
					const resizeSelection = objectEl.selectAll("div.resize-accessor").data(resizePositions)
					resizeSelection
						.enter()
						.append("div")
						.attr("class", d => `resize-accessor resize-${d}`)
						.on("mousedown.drag", d => {
							const { x, y, width, height } = object.el.getBoundingClientRect()
							objectResizeDragStart$.next({
								position: d,
								startObjectX: x,
								startObjectY: y,
								startObjectWidth: width,
								startObjectHeight: height,
								startClientX: event.clientX,
								startClientY: event.clientY,
							})

							select(event.view)
								.on(
									"mousemove.drag",
									() => {
										event.preventDefault()
										event.stopImmediatePropagation()
										if (object.type !== "dev-suite") {
											objectResizeDragging$.next({
												position: d,
												object,
												clientX: event.clientX,
												clientY: event.clientY,
											})
										}
									},
									true
								)
								.on(
									"mouseup.drag",
									() => {
										objectResizeDragEnd$.next({ startObjectX: x, startObjectY: y, event, object })
										select(event.view).on("mousemove.drag mouseup.drag", null)
									},
									true
								)
						})

					resizeSelection.exit().remove()
				})
			})
		)
		.subscribe()

	objectResizeDragStart$
		.pipe(
			inEditMode(inEditMode$),
			switchMap(({ startObjectX, startObjectY, startObjectWidth, startObjectHeight }) =>
				objectResizeDragging$.pipe(
					tap(() => isResizing$.next(true)),
					tap(() => {
						select("body")
							.append("div")
							.attr("class", "dev-suite__shadow-element")
							.style("width", `${startObjectWidth}px`)
							.style("height", `${startObjectHeight}px`)
							.style("left", `${startObjectX}px`)
							.style("top", `${startObjectY}px`)
					}),
					take(1)
				)
			)
		)
		.subscribe()

	const resizeDelta$ = objectResizeDragging$.pipe(
		inEditMode(inEditMode$),
		withLatestFrom(objectResizeDragStart$),
		map(
			([
				{ object, clientX, clientY },
				{ position, startObjectX, startObjectY, startObjectWidth, startObjectHeight, startClientX, startClientY },
			]) => {
				const deltaX = clientX - startClientX
				const deltaY = clientY - startClientY

				return {
					x: ["left", "top-left", "bottom-left"].includes(position) ? startObjectX + deltaX : startObjectX,
					y: ["top", "top-left", "top-right"].includes(position) ? startObjectY + deltaY : startObjectY,
					width: ["right", "top-right", "bottom-right"].includes(position)
						? startObjectWidth + deltaX
						: ["left", "top-left", "bottom-left"].includes(position)
						? startObjectWidth - deltaX
						: startObjectWidth,
					height: ["bottom", "bottom-left", "bottom-right"].includes(position)
						? startObjectHeight + deltaY
						: ["top", "top-left", "top-right"].includes(position)
						? startObjectHeight - deltaY
						: startObjectHeight,
					object,
					deltaX: ["left", "top-left", "bottom-left"].includes(position) ? deltaX : 0,
					deltaY: ["top", "top-left", "top-right"].includes(position) ? deltaY : 0,
					deltaWidth: ["right", "top-right", "bottom-right"].includes(position)
						? deltaX
						: ["left", "top-left", "bottom-left"].includes(position)
						? -deltaX
						: 0,
					deltaHeight: ["bottom", "bottom-left", "bottom-right"].includes(position)
						? deltaY
						: ["top", "top-left", "top-right"].includes(position)
						? -deltaY
						: 0,
				}
			}
		)
	)

	resizeDelta$
		.pipe(
			inEditMode(inEditMode$),
			tap(({ x, y, width, height }) => {
				select(".dev-suite__shadow-element")
					.style("top", `${y}px`)
					.style("left", `${x}px`)
					.style("width", `${width}px`)
					.style("height", `${height}px`)
			})
		)
		.subscribe()

	objectResizeDragEnd$
		.pipe(
			inEditMode(inEditMode$),
			withLatestFrom(isResizing$, sheetObjects$),
			filter(([_, isResizing]) => isResizing),
			tap(([{ event, object }, _isResizing, sheetObjects]) => {
				selectAll(".dev-suite__shadow-element").remove()
			}),
			tap(() => isResizing$.next(false)),
			withLatestFrom(resizeDelta$, gridSize$),
			map(([_, { object, deltaX, deltaY, deltaWidth, deltaHeight }, { width: gridWidth, height: gridHeight }]) => {
				const deltaXAsAPercent = (deltaX / gridWidth) * 100
				const deltaYAsAPercent = (deltaY / gridHeight) * 100
				const deltaWidthAsAPercent = (deltaWidth / gridWidth) * 100
				const deltaHeightAsAPercent = (deltaHeight / gridHeight) * 100
				return { object, deltaXAsAPercent, deltaYAsAPercent, deltaWidthAsAPercent, deltaHeightAsAPercent }
			}),
			withLatestFrom(sheetProps$),
			map(
				([{ object, deltaXAsAPercent, deltaYAsAPercent, deltaWidthAsAPercent, deltaHeightAsAPercent }, sheetProps]) => {
					const updateCells = sheetProps.cells.map(cell => {
						if (cell.name === object.id) {
							return {
								...cell,
								bounds: {
									...cell.bounds,
									x: cell.bounds.x + deltaXAsAPercent,
									y: cell.bounds.y + deltaYAsAPercent,
									width: cell.bounds.width + deltaWidthAsAPercent,
									height: cell.bounds.height + deltaHeightAsAPercent,
								},
								col: undefined,
								row: undefined,
								colspan: undefined,
								rowspan: undefined,
							}
						} else return cell
					})
					return { ...sheetProps, cells: updateCells }
				}
			),
			setProps(sheetObj$)
		)
		.subscribe()
}
