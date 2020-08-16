import { merge, Subject } from "rxjs"
import { scan, shareReplay, startWith, takeUntil } from "rxjs/operators"
import * as actions from "./actions"

export default destroy$ => {
	const select$ = new Subject()
	const clear$ = new Subject()

	const selectedObjects$ = merge(select$, clear$).pipe(
		scan((acc, { type, payload }) => {
			switch (type) {
				case actions.CLEAR_SELECTED_OBJECTS:
					return []

				case actions.SELECT_OBJECT:
					const { id, shiftMode } = payload
					if (shiftMode) {
						if (acc.includes(id)) {
							const objectIndex = acc.indexOf(id)
							return [...acc.slice(0, objectIndex), ...acc.slice(objectIndex + 1)]
						} else return [...acc, id]
					} else return [id]

				default:
					return acc
			}
		}, []),
		startWith([]),
		takeUntil(destroy$),
		shareReplay(1)
	)

	const select = id => select$.next(id)
	const clear = id => clear$.next(id)

	return { selectedObjects$, select, clear }
}
