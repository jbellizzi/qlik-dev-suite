export default qlik => [
	"$scope",
	"$element",
	function($scope, $element) {
		const currentSheet = qlik.navigation.getCurrentSheetId().sheetId

		// ..controller code here
		const model = $scope.ext.model.enigmaModel
		const app = $scope.ext.model.enigmaModel.app

		const sheetObject = app.getObject(currentSheet)
		const sheetLayout = sheetObject.then(sheet => sheet.getLayout())

		const sheetObjects = sheetLayout.then(layout => layout.qChildList.qItems.map(item => item.qInfo.qId))

		const objectElements = sheetObjects.then(objectIds =>
			objectIds.map(id => ({
				el: document.querySelector(`[tid="${id}"]`),
				id,
			}))
		)

		let selectedObjects = []

		objectElements.then(objects => {
			document.addEventListener("click", evt => {
				const { shiftKey } = evt

				let clickedObject = undefined
				objects.forEach(({ el, id }) => {
					if (el.contains(evt.target)) {
						clickedObject = { el, id }
					}
				})

				if (clickedObject) {
					if (shiftKey) {
						if (selectedObjects.includes(clickedObject.id)) {
							const idIndex = selectedObjects.indexOf(clickedObject.id)
							selectedObjects = [...selectedObjects.slice(0, idIndex), ...selectedObjects.slice(idIndex + 1)]
						} else {
							selectedObjects.push(clickedObject.id)
						}
					} else {
						selectedObjects = [clickedObject.id]
					}
				} else {
					if (shiftKey === false) {
						selectedObjects = []
					}
				}

				objects.forEach(({ el, id }) => {
					if (selectedObjects.includes(id)) el.classList.add("dev-suite__selected")
					else el.classList.remove("dev-suite__selected")
				})
			})
		})

		const keyCodes = {
			37: { direction: "left", type: "col", position: -1 },
			38: { direction: "up", type: "row", position: -1 },
			39: { direction: "right", type: "col", position: 1 },
			40: { direction: "down", type: "row", position: 1 },
		}
		document.addEventListener("keydown", evt => {
			if ([37, 38, 39, 40].includes(evt.keyCode)) {
				sheetObject
					.then(sheet => sheet.getProperties())
					.then(props => {
						const newCells = props.cells.map(cell => {
							if (selectedObjects.includes(cell.name)) {
								return {
									...cell,
									[keyCodes[evt.keyCode].type]: cell[keyCodes[evt.keyCode].type] + keyCodes[evt.keyCode].position,
									bounds: undefined,
								}
							} else return cell
						})

						return {
							...props,
							cells: newCells,
						}
					})
					.then(newProps => {
						return sheetObject.then(sheet => sheet.setProperties(newProps))
					})
			}
		})
	},
]
