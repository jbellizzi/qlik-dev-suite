import { initialProperties, template, definition, controller, paint, resize } from "./methods"
import "./style.css"

window.define(["qlik"], function(qlik) {
	return {
		initialProperties,
		template,
		definition,
		controller: controller(qlik),
		paint,
		resize,
	}
})
