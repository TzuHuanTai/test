import { Component, ComponentFactoryResolver } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent {
	title = 'ng9new';
	resolver= [];

	constructor(ComponentFactoryResolver: ComponentFactoryResolver) {
		console.log('AppComponent');
		let test = ComponentFactoryResolver['_factories'].forEach((element) => {
			console.log(element)
		});
		this.resolver = Array.from(ComponentFactoryResolver['_factories'].values());
	}
}
