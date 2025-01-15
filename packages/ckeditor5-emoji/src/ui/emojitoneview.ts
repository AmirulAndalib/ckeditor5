/**
 * @license Copyright (c) 2003-2025, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-licensing-options
 */

/**
 * @module emoji/ui/emojitoneview
 */

import {
	createDropdown,
	addToolbarToDropdown,
	ListItemButtonView,
	View,
	ViewCollection,
	DropdownButtonView
} from 'ckeditor5/src/ui.js';
import type { Locale } from 'ckeditor5/src/utils.js';
import type { SkinToneId } from '../emojiconfig.js';

import '../../theme/emojitone.css';

const SKIN_TONES: Array<SkinTone> = [
	{ id: 'default', icon: '👋', tooltip: 'Default skin tone' },
	{ id: 'light', icon: '👋🏻', tooltip: 'Light skin tone' },
	{ id: 'medium-light', icon: '👋🏼', tooltip: 'Medium Light skin tone' },
	{ id: 'medium', icon: '👋🏽', tooltip: 'Medium skin tone' },
	{ id: 'medium-dark', icon: '👋🏾', tooltip: 'Medium Dark skin tone' },
	{ id: 'dark', icon: '👋🏿', tooltip: 'Dark skin tone' }
];

type SkinTone = {
	id: SkinToneId;
	icon: string;
	tooltip: string;
};

export default class EmojiToneView extends View {
	/**
	 * Active skin tone.
	 *
	 * @observable
	 */
	declare public skinTone: SkinToneId;

	/**
	 * A dropdown element for selecting an active skin tone.
	 */
	public readonly mainDropdownButton: DropdownButtonView;

	/**
	 * Option elements to select an active tone.
	 */
	public readonly dropdownButtons: ViewCollection<ListItemButtonView>;

	/**
	 * @inheritDoc
	 */
	constructor( locale: Locale, { skinTone }: { skinTone: SkinToneId } ) {
		super( locale );

		const t = locale.t;

		this.set( 'skinTone', skinTone );

		this.mainDropdownButton = new DropdownButtonView();
		const dropdownView = createDropdown( locale, this.mainDropdownButton );
		this.dropdownButtons = new ViewCollection(
			SKIN_TONES.map( ( { id, icon, tooltip } ) => this._createButton( locale, id, icon, tooltip ) )
		);

		this.mainDropdownButton.withText = true;
		this.mainDropdownButton.label = this._getSkinTone( this.skinTone ).icon;
		this.mainDropdownButton.tooltip = 'Select skin tone';

		addToolbarToDropdown(
			dropdownView,
			this.dropdownButtons,
			{
				isVertical: true,
				isCompact: true,
				enableActiveItemFocusOnDropdownOpen: true,
				ariaLabel: t( 'Skin tone toolbar' )
			}
		);

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [ 'ck', 'ck-emoji-tone' ]
			},
			children: [ dropdownView ]
		} );
	}

	/**
	 * @inheritDoc
	 */
	public focus(): void {
		this.mainDropdownButton.focus();
	}

	/**
	 * Helper method for creating the button view element.
	 */
	private _createButton( locale: Locale, buttonSkinToneId: SkinToneId, icon: string, tooltip: string ): ListItemButtonView {
		const buttonView = new ListItemButtonView( locale );

		buttonView.set( {
			label: icon,
			withText: true,
			tooltip,
			tooltipPosition: 'e',
			hasCheckSpace: true,
			isToggleable: true
		} );

		buttonView.bind( 'isOn' ).to( this, 'skinTone', newSkinToneId => newSkinToneId === buttonSkinToneId );

		// Execute command.
		this.listenTo( buttonView, 'execute', () => {
			this.skinTone = buttonSkinToneId;
			this.mainDropdownButton.label = this._getSkinTone( buttonSkinToneId ).icon;
		} );

		return buttonView;
	}

	private _getSkinTone( skinToneId: SkinToneId ): SkinTone {
		return SKIN_TONES.find( tone => tone.id === skinToneId )!;
	}
}
