export default function($element, layout) {
	// ..resize code here
	const viz = this.$scope.viz

	viz.getSheetProps$.next()
	viz.getGridSize$.next(document.querySelector("#grid").getBoundingClientRect())
}
