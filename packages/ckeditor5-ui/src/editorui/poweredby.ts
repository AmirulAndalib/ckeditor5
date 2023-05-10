/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module ui/editorui/poweredby
 */

import type { Editor } from '@ckeditor/ckeditor5-core';
import {
	Rect,
	DomEmitterMixin,
	findClosestScrollableAncestor,
	verifyLicense,
	type PositionOptions,
	type Locale
} from '@ckeditor/ckeditor5-utils';
import BalloonPanelView from '../panel/balloon/balloonpanelview';
import IconView from '../icon/iconview';
import View from '../view';
import { throttle, type DebouncedFunc } from 'lodash-es';

import poweredByIcon from '../../theme/icons/project-logo.svg';
import type { UiConfig } from '@ckeditor/ckeditor5-core/src/editor/editorconfig';

const ICON_WIDTH = 53;
const ICON_HEIGHT = 10;
const NARROW_ROOT_WIDTH_THRESHOLD = 250;
const OFF_THE_SCREEN_POSITION = {
	top: -9999999,
	left: -9999999,
	name: 'invalid'
};

type PoweredByConfig = Required<UiConfig>[ 'poweredBy' ];

/**
 * A helper that enables the "powered by" feature in the editor and renders a link to the project's
 * webpage next to the bottom of the editing root when the editor is focused.
 *
 * @private
 */
export default class PoweredBy extends DomEmitterMixin() {
	/**
	 * A reference to the balloon panel hosting and positioning the "powered by" link and logo.
	 */
	private _balloonView: BalloonPanelView | null;

	/**
	 * Editor instance the helper was created for.
	 */
	private readonly editor: Editor;

	/**
	 * A throttled version of the {@link #_showBalloon} method meant for frequent use to avoid performance loss.
	 */
	private _showBalloonThrottled: DebouncedFunc<() => void>;

	/**
	 * Creates a "powered by" helper for a given editor. The feature is initialized on Editor#ready
	 * event.
	 *
	 * @param editor
	 */
	constructor( editor: Editor ) {
		super();

		this.editor = editor;
		this._balloonView = null;
		this._showBalloonThrottled = throttle( this._showBalloon.bind( this ), 50, { leading: true } );

		editor.on( 'ready', this._handleEditorReady.bind( this ) );
	}

	/**
	 * Destroys the "powered by" helper along with its view.
	 */
	public destroy(): void {
		const balloon = this._balloonView;

		if ( balloon ) {
			balloon.unpin();
			balloon.destroy();
			this._balloonView = null;
		}

		this._showBalloonThrottled.cancel();
		this.stopListening();
	}

	/**
	 * Enables "powered by" label once the editor (ui) is ready.
	 */
	private _handleEditorReady(): void {
		const editor = this.editor;

		/* istanbul ignore next -- @preserve */
		if ( verifyLicense( editor.config.get( 'licenseKey' ) ) === 'VALID' ) {
			return;
		}

		// No view means no body collection to append the powered by balloon to.
		if ( !editor.ui.view ) {
			return;
		}

		editor.ui.focusTracker.on( 'change:isFocused', ( evt, data, isFocused ) => {
			if ( isFocused ) {
				this._showBalloon();
			} else {
				this._hideBalloon();
			}
		} );

		editor.ui.on( 'update', () => {
			if ( !editor.ui.focusTracker.isFocused ) {
				return;
			}

			this._showBalloonThrottled();
		} );

		// TODO: Probably hide during scroll.
		// TODO: Problem with Rect#isVisible() and floating editors (comments) vs. hiding the view when cropped by parent with overflow.
		// TODO: Update position once an image loaded.
		// TODO: Make the position (side) configurable.
	}

	/**
	 * Creates an instance of the {@link module:ui/panel/balloon/balloonpanelview~BalloonPanelView balloon panel}
	 * with the "powered by" view inside ready for positioning.
	 */
	private _createBalloonView() {
		const editor = this.editor;
		const balloon = this._balloonView = new BalloonPanelView();
		const view = new PoweredByView( editor.locale );

		balloon.content.add( view );
		balloon.withArrow = false;
		balloon.class = 'ck-powered-by-balloon';

		editor.ui.view.body.add( balloon );
		editor.ui.focusTracker.add( balloon.element! );

		this._balloonView = balloon;
	}

	/**
	 * Attempts to display the balloon with the "powered by" view.
	 */
	private _showBalloon() {
		const attachOptions = getBalloonAttachOptions( this.editor );

		if ( attachOptions ) {
			if ( !this._balloonView ) {
				this._createBalloonView();
			}

			this._balloonView!.pin( attachOptions );
		}
	}

	/**
	 * Hides the "powered by" balloon if already visible.
	 */
	private _hideBalloon() {
		if ( this._balloonView ) {
			this._balloonView!.unpin();
		}
	}
}

/**
 * A view displaying a "powered by" label and project logo wrapped in a link.
 */
class PoweredByView extends View<HTMLDivElement> {
	/**
	 * Created an instance of the "powered by" view.
	 *
	 * @param locale The localization services instance.
	 */
	constructor( locale: Locale ) {
		super( locale );

		const iconView = new IconView();
		const bind = this.bindTemplate;

		iconView.set( {
			content: poweredByIcon,
			isColorInherited: false
		} );

		iconView.extendTemplate( {
			attributes: {
				style: {
					width: ICON_WIDTH + 'px',
					height: ICON_HEIGHT + 'px'
				}
			}
		} );

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [ 'ck', 'ck-powered-by' ]
			},
			children: [
				{
					tag: 'a',
					attributes: {
						href: 'https://ckeditor.com',
						target: '_blank',
						tabindex: '-1'
					},
					children: [
						{
							tag: 'span',
							attributes: {
								class: [ 'ck', 'ck-powered-by__label' ]
							},
							children: [ 'Powered by' ]
						},
						iconView
					],
					on: {
						dragstart: bind.to(
							/* istanbul ignore next -- @preserve */
							evt => evt.preventDefault()
						)
					}
				}
			]
		} );
	}
}

function getBalloonAttachOptions( editor: Editor ): Partial<PositionOptions> | null {
	const focusedDomRoot = getFocusedDOMRoot( editor );

	if ( !focusedDomRoot ) {
		return null;
	}

	const poweredByConfig = getNormalizedConfig( editor )!;
	const positioningFunction = poweredByConfig.side === 'right' ?
		getLowerRightCornerPosition( focusedDomRoot, poweredByConfig ) :
		/* istanbul ignore next -- @preserve */
		getLowerLeftCornerPosition( focusedDomRoot, poweredByConfig );

	return {
		target: focusedDomRoot,
		positions: [ positioningFunction ]
	};
}

function getLowerRightCornerPosition( focusedDomRoot: HTMLElement, config: PoweredByConfig ) {
	return getLowerCornerPosition( focusedDomRoot, config, ( rootRect, balloonRect ) => {
		return rootRect.left + rootRect.width - balloonRect.width - config.horizontalOffset;
	} );
}

/* istanbul ignore next -- @preserve */
function getLowerLeftCornerPosition( focusedDomRoot: HTMLElement, config: PoweredByConfig ) {
	return getLowerCornerPosition( focusedDomRoot, config, rootRect => rootRect.left + config.horizontalOffset );
}

function getLowerCornerPosition(
	focusedDomRoot: HTMLElement,
	config: PoweredByConfig,
	getBalloonLeft: ( rootRect: Rect, balloonRect: Rect ) => number
) {
	return ( rootRect: Rect, balloonRect: Rect ) => {
		const visibleRootRect = rootRect.getVisible();

		// Root cropped by ancestors.
		/* istanbul ignore next -- @preserve */
		if ( !visibleRootRect ) {
			return OFF_THE_SCREEN_POSITION;
		}

		const isRootNarrow = rootRect.width < NARROW_ROOT_WIDTH_THRESHOLD;

		let balloonTop;

		/* istanbul ignore else -- @preserve */
		if ( config.position === 'inside' ) {
			balloonTop = rootRect.bottom - balloonRect.height;
		}
		else {
			balloonTop = rootRect.bottom - balloonRect.height / 2;
		}

		balloonTop -= config.verticalOffset;

		const balloonLeft = getBalloonLeft( rootRect, balloonRect );

		/* istanbul ignore else -- @preserve */
		if ( config.position === 'inside' ) {
			const newBalloonRect = balloonRect.clone().moveTo( balloonLeft, balloonTop );

			// The watermark cannot be positioned in this corner because the corner is not quite visible.
			/* istanbul ignore next -- @preserve */
			if ( newBalloonRect.getIntersectionArea( visibleRootRect ) < newBalloonRect.getArea() ) {
				return OFF_THE_SCREEN_POSITION;
			}
		}
		else {
			/* istanbul ignore next -- @preserve */
			const firstScrollableRootAncestor = findClosestScrollableAncestor( focusedDomRoot );

			/* istanbul ignore next -- @preserve */
			if ( firstScrollableRootAncestor ) {
				const firstScrollableRootAncestorRect = new Rect( firstScrollableRootAncestor );

				// The watermark cannot be positioned in this corner because the corner is "not visible enough".
				/* istanbul ignore next -- @preserve */
				if ( visibleRootRect.bottom + balloonRect.height / 2 > firstScrollableRootAncestorRect.bottom ) {
					return OFF_THE_SCREEN_POSITION;
				}
			}
		}

		/* istanbul ignore next -- @preserve */
		return {
			top: balloonTop,
			left: balloonLeft,
			name: `root-width_${ isRootNarrow ? 'narrow' : 'default' }-position_${ config.position }-side_${ config.side }`
		};
	};
}

function getFocusedDOMRoot( editor: Editor ) {
	for ( const [ , domRoot ] of editor.editing.view.domRoots ) {
		const { activeElement } = domRoot.ownerDocument;
		if ( activeElement === domRoot || domRoot.contains( activeElement ) ) {
			return domRoot;
		}
	}

	return null;
}

function getNormalizedConfig( editor: Editor ): PoweredByConfig {
	const userConfig = editor.config.get( 'ui.poweredBy' );
	/* istanbul ignore next -- @preserve */
	const position = userConfig && userConfig.position || 'inside';

	return {
		position,
		verticalOffset: position === 'inside' ? 5 : /* istanbul ignore next -- @preserve */ 0,
		horizontalOffset: 5,

		side: editor.locale.contentLanguageDirection === 'ltr' ? 'right' : /* istanbul ignore next -- @preserve */ 'left',
		...userConfig
	};
}
