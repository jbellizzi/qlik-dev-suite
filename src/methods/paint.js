export default function($element, layout) {
	// ..paint code here
	const viz = this.$scope.viz

	viz.retrieveNewSheetProps$.next()
}
