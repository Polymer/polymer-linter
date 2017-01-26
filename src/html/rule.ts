/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
import {Document} from 'polymer-analyzer/lib/model/model';
import {Warning} from 'polymer-analyzer/lib/warning/warning';

import {Rule} from '../rule';

/**
 * An abstract rule that operates only over HTML files.
 */
export abstract class HtmlRule extends Rule {
  async check(document: Document): Promise<Warning[]> {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return [];
    }
    return this.checkFile(parsedDocument, document);
  }

  abstract checkFile(parsedDocument: ParsedHtmlDocument, document: Document):
      Promise<Warning[]>;
}
