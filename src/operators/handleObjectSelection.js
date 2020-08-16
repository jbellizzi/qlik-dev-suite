import { Observable } from "rxjs"
import { map, withLatestFrom, tap } from "rxjs/operators"
import { actions } from "../util"

export default (objects$, selectObject, clearSelectedObjects) => source =>
	new Observable(observer =>
		source
			.pipe(
				map(({ target, shiftKey }) => ({ target, shiftKey })),
				withLatestFrom(objects$),
				tap(([{ target, shiftKey }, sheetObjects]) => {
					const clickedObject = sheetObjects.find(({ el }) => el.contains(target))
					if (clickedObject)
						selectObject({ type: actions.SELECT_OBJECT, payload: { id: clickedObject.id, shiftMode: shiftKey } })
					else if (shiftKey === false) clearSelectedObjects({ type: actions.CLEAR_SELECTED_OBJECTS })
				})
			)
			.subscribe({
				next() {
					observer.next("updated")
				},
				error(err) {
					observer.error(err)
				},
				complete() {
					observer.complete()
				},
			})
	)
