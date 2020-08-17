import { from, Observable } from "rxjs"
import { filter, switchMap, withLatestFrom } from "rxjs/operators"

export default (sheetObj$, selectedObjects$) => source =>
	new Observable(observer =>
		source
			.pipe(
				/** get sheet object */
				withLatestFrom(sheetObj$),
				/** get sheet full property tree */
				switchMap(([_, sheetObj]) =>
					from(sheetObj.getFullPropertyTree().then(propertyTree => ({ propertyTree, sheetObj })))
				),
				/** get all selected objects */
				withLatestFrom(selectedObjects$),
				/** stop if no objects are selected */
				filter(([_propertyTree, selectedObjects]) => selectedObjects.length > 0),
				/** extract the selected objects from the property tree qChildren and qProperty.cells and set new properties */
				switchMap(([{ propertyTree, sheetObj }, selectedObjects]) =>
					sheetObj.setFullPropertyTree({
						...propertyTree,
						qProperty: {
							...propertyTree.qProperty,
							cells: propertyTree.qProperty.cells.filter(cell => !selectedObjects.includes(cell.name)),
						},
						qChildren: propertyTree.qChildren.filter(qChild => !selectedObjects.includes(qChild.qProperty.qInfo.qId)),
					})
				)
			)
			.subscribe({
				next() {
					observer.next("deleted")
				},
				error(err) {
					observer.error(err)
				},
				complete() {
					observer.complete()
				},
			})
	)
