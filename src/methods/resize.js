export default qlik =>
	function($element, layout) {
		// ..resize code here
		const viz = this.$scope.viz

		// viz.getGridSize$.next(document.querySelector("#grid").getBoundingClientRect())
		viz.inEditMode$.next(qlik.navigation.getMode())
		viz.retrieveNewSheetProps$.next()
		viz.gridSize$.next(document.querySelector("#grid"))
	}
