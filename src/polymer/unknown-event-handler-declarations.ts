/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Document} from 'polymer-analyzer/lib/model/model';

import stripIndent = require('strip-indent');
import {Warning, Severity} from 'polymer-analyzer/lib/warning/warning';
import {stripWhitespace} from '../util';
import {Rule} from '../rule';
import {registry} from '../registry';

export class UnknownEventHandlerDeclarations extends Rule {
  code = 'unknown-event-handler-declarations';
  description = stripIndent(`
      Warns for unknown event handler declarations:

          <paper-button on-unknown-event="foo">

      Correct syntax:

          <paper-button on-known-event="foo">
  `).trim();

  constructor() {
    super();
  }

  async check(document: Document) {
    const warnings: Warning[] = [];
    const elements = document.getByKind('element-reference');

    for (const element of elements) {
      const definition = document.getOnlyAtId(
          'polymer-element',
          element.tagName,
          {imported: true, externalPackages: true});

      if (definition) {
        const events = definition.events.map((e) => e.name);

        for (const attr of element.attributes) {
          const eventName = attr.name.substr(3);
          if (attr.name.indexOf('on-') === 0 &&
              events.indexOf(eventName) === -1) {
            warnings.push({
              code: this.code,
              message: stripWhitespace(`
                  Unknown event handler "${eventName}" on tag`),
              severity: Severity.WARNING,
              sourceRange: attr.sourceRange
            });
          }
        }
      }
    }

    return warnings;
  }
}

registry.register(new UnknownEventHandlerDeclarations());
