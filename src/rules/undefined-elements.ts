/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {ElementReference} from 'polymer-analyzer/lib/model/element-reference';
import {Document} from 'polymer-analyzer/lib/model/model';
import {Severity, Warning} from 'polymer-analyzer/lib/warning/warning';

import {Rule} from '../rule';

export class UndefinedElements implements Rule {
  public async check(document: Document): Promise<Warning[]> {
    const warnings: Warning[] = [];
    const parsedHtml = document.parsedDocument;

    if (!(parsedHtml instanceof ParsedHtmlDocument)) {
      return warnings;
    }

    const elements =
        Array.from(document.getByKind('element')).map(e => e.tagName);

    const refs = document.getByKind('element-reference');

    for (const ref of refs) {
      const elementRef = ref as ElementReference;
      if (elements.indexOf(elementRef.tagName) === -1) {
        warnings.push({
          code: 'undefined-elements',
          message: `The element ${elementRef.tagName} is not defined`,
          severity: Severity.WARNING,
          sourceRange: ref.sourceRange!
        });
      }
    }

    return warnings;
  }
}
