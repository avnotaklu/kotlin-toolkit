// Description: This is a set of runtime errors that the CFI interpreter can throw.
// Rationale: These error types extend the basic javascript error object so error things like the stack trace are
//   included with the runtime errors.

// REFACTORING CANDIDATE: This type of error may not be required in the long run. The parser should catch any syntax errors,
//   provided it is error-free, and as such, the AST should never really have any node type errors, which are essentially errors
//   in the structure of the AST. This error should probably be refactored out when the grammar and interpreter are more stable.

import $ from 'jquery'

const NodeTypeError = function (node, message) {
  function NodeTypeError() {
    this.node = node;
  }

  NodeTypeError.prototype = new Error(message);
  NodeTypeError.constructor = NodeTypeError;

  return new NodeTypeError();
};

// REFACTORING CANDIDATE: Might make sense to include some more specifics about the out-of-rangeyness.
const OutOfRangeError = function (targetIndex, maxIndex, message) {
  function OutOfRangeError() {
    this.targetIndex = targetIndex;
    this.maxIndex = maxIndex;
  }

  OutOfRangeError.prototype = new Error(message);
  OutOfRangeError.constructor = OutOfRangeError();

  return new OutOfRangeError();
};

// REFACTORING CANDIDATE: This is a bit too general to be useful. When I have a better understanding of the type of errors
//   that can occur with the various terminus conditions, it'll make more sense to revisit this.
const TerminusError = function (terminusType, terminusCondition, message) {
  function TerminusError() {
    this.terminusType = terminusType;
    this.terminusCondition = terminusCondition;
  }

  TerminusError.prototype = new Error(message);
  TerminusError.constructor = TerminusError();

  return new TerminusError();
};

const CFIAssertionError = function (
  expectedAssertion,
  targetElementAssertion,
  message
) {
  function CFIAssertionError() {
    this.expectedAssertion = expectedAssertion;
    this.targetElementAssertion = targetElementAssertion;
  }

  CFIAssertionError.prototype = new Error(message);
  CFIAssertionError.constructor = CFIAssertionError();

  return new CFIAssertionError();
};

// Description: This model contains the implementation for "instructions" included in the EPUB CFI domain specific language (DSL).
//   Lexing and parsing a CFI produces a set of executable instructions for processing a CFI (represented in the AST).
//   This object contains a set of functions that implement each of the executable instructions in the AST.

const CFIInstructions = {
  // ------------------------------------------------------------------------------------ //
  //  "PUBLIC" METHODS (THE API)                                                          //
  // ------------------------------------------------------------------------------------ //

  // Description: Follows a step
  // Rationale: The use of children() is important here, as this jQuery method returns a tree of xml nodes, EXCLUDING
  //   CDATA and text nodes. When we index into the set of child elements, we are assuming that text nodes have been
  //   excluded.
  // REFACTORING CANDIDATE: This should be called "followIndexStep"
  getNextNode: function (
    CFIStepValue,
    $currNode,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    // Find the jquery index for the current node
    var $targetNode;
    if (CFIStepValue % 2 == 0) {
      $targetNode = this.elementNodeStep(
        CFIStepValue,
        $currNode,
        classBlacklist,
        elementBlacklist,
        idBlacklist
      );
    } else {
      $targetNode = this.inferTargetTextNode(
        CFIStepValue,
        $currNode,
        classBlacklist,
        elementBlacklist,
        idBlacklist
      );
    }

    return $targetNode;
  },

  // Description: This instruction executes an indirection step, where a resource is retrieved using a
  //   link contained on a attribute of the target element. The attribute that contains the link differs
  //   depending on the target.
  // Note: Iframe indirection will (should) fail if the iframe is not from the same domain as its containing script due to
  //   the cross origin security policy
  followIndirectionStep: function (
    CFIStepValue,
    $currNode,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var that = this;
    var $contentDocument;
    var $blacklistExcluded;
    var $startElement;
    var $targetNode;

    // TODO: This check must be expanded to all the different types of indirection step
    // Only expects iframes, at the moment
    if ($currNode === undefined || !$currNode.is("iframe")) {
      throw NodeTypeError($currNode, "expected an iframe element");
    }

    // Check node type; only iframe indirection is handled, at the moment
    if ($currNode.is("iframe")) {
      // Get content
      $contentDocument = $currNode.contents();

      // Go to the first XHTML element, which will be the first child of the top-level document object
      $blacklistExcluded = this.applyBlacklist(
        $contentDocument.children(),
        classBlacklist,
        elementBlacklist,
        idBlacklist
      );
      $startElement = $($blacklistExcluded[0]);

      // Follow an index step
      $targetNode = this.getNextNode(
        CFIStepValue,
        $startElement,
        classBlacklist,
        elementBlacklist,
        idBlacklist
      );

      // Return that shit!
      return $targetNode;
    }

    // TODO: Other types of indirection
    // TODO: $targetNode.is("embed")) : src
    // TODO: ($targetNode.is("object")) : data
    // TODO: ($targetNode.is("image") || $targetNode.is("xlink:href")) : xlink:href
  },

  // Description: Injects an element at the specified text node
  // Arguments: a cfi text termination string, a jquery object to the current node
  textTermination: function ($currNode, textOffset, elementToInject) {
    // Get the first node, this should be a text node
    if ($currNode === undefined) {
      throw NodeTypeError(
        $currNode,
        "expected a terminating node, or node list"
      );
    } else if ($currNode.length === 0) {
      throw TerminusError(
        "Text",
        "Text offset:" + textOffset,
        "no nodes found for termination condition"
      );
    }

    $currNode = this.injectCFIMarkerIntoText(
      $currNode,
      textOffset,
      elementToInject
    );
    return $currNode;
  },

  // Description: Checks that the id assertion for the node target matches that on
  //   the found node.
  targetIdMatchesIdAssertion: function ($foundNode, idAssertion) {
    if ($foundNode.attr("id") === idAssertion) {
      return true;
    } else {
      return false;
    }
  },

  // ------------------------------------------------------------------------------------ //
  //  "PRIVATE" HELPERS                                                                   //
  // ------------------------------------------------------------------------------------ //

  // Description: Step reference for xml element node. Expected that CFIStepValue is an even integer
  elementNodeStep: function (
    CFIStepValue,
    $currNode,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $targetNode;
    var $blacklistExcluded;
    var numElements;
    var jqueryTargetNodeIndex = CFIStepValue / 2 - 1;

    $blacklistExcluded = this.applyBlacklist(
      $currNode.children(),
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );
    numElements = $blacklistExcluded.length;

    if (this.indexOutOfRange(jqueryTargetNodeIndex, numElements)) {
      throw OutOfRangeError(jqueryTargetNodeIndex, numElements - 1, "");
    }

    $targetNode = $($blacklistExcluded[jqueryTargetNodeIndex]);
    return $targetNode;
  },

  retrieveItemRefHref: function ($itemRefElement, $packageDocument) {
    return $("#" + $itemRefElement.attr("idref"), $packageDocument).attr(
      "href"
    );
  },

  indexOutOfRange: function (targetIndex, numChildElements) {
    return targetIndex > numChildElements - 1 ? true : false;
  },

  // Rationale: In order to inject an element into a specific position, access to the parent object
  //   is required. This is obtained with the jquery parent() method. An alternative would be to
  //   pass in the parent with a filtered list containing only children that are part of the target text node.
  injectCFIMarkerIntoText: function (
    $textNodeList,
    textOffset,
    elementToInject
  ) {
    var nodeNum;
    var currNodeLength;
    var currNodeMaxIndex = 0;
    var currTextPosition = 0;
    var nodeOffset;
    var originalText;
    var $injectedNode;
    var $newTextNode;
    // The iteration counter may be incorrect here (should be $textNodeList.length - 1 ??)
    for (nodeNum = 0; nodeNum < $textNodeList.length; nodeNum++) {
      if ($textNodeList[nodeNum].nodeType === 3) {
        currNodeMaxIndex =
          $textNodeList[nodeNum].nodeValue.length + currTextPosition;
        nodeOffset = textOffset - currTextPosition;

        if (currNodeMaxIndex > textOffset) {
          // This node is going to be split and the components re-inserted
          originalText = $textNodeList[nodeNum].nodeValue;

          // Before part
          $textNodeList[nodeNum].nodeValue = originalText.slice(0, nodeOffset);

          // Injected element
          $injectedNode = $(elementToInject).insertAfter(
            $textNodeList.eq(nodeNum)
          );

          // After part
          $newTextNode = $(
            document.createTextNode(
              originalText.slice(nodeOffset, originalText.length)
            )
          );
          $($newTextNode).insertAfter($injectedNode);

          return $textNodeList.parent();
        } else if (currNodeMaxIndex == textOffset) {
          //the node should be injected directly after the complete text node
          $injectedNode = $(elementToInject).insertAfter(
            $textNodeList.eq(nodeNum)
          );
          return $textNodeList.parent();
        } else {
          currTextPosition = currNodeMaxIndex;
        }
      }
    }

    throw TerminusError(
      "Text",
      "Text offset:" + textOffset,
      "The offset exceeded the length of the text"
    );
  },

  // Description: This method finds a target text node and then injects an element into the appropriate node
  // Arguments: A step value that is an odd integer. A current node with a set of child elements.
  // Rationale: The possibility that cfi marker elements have been injected into a text node at some point previous to
  //   this method being called (and thus splitting the original text node into two separate text nodes) necessitates that
  //   the set of nodes that compromised the original target text node are inferred and returned.
  // Notes: Passed a current node. This node should have a set of elements under it. This will include at least one text node,
  //   element nodes (maybe), or possibly a mix.
  // REFACTORING CANDIDATE: This method is pretty long. Worth investigating to see if it can be refactored into something clearer.
  inferTargetTextNode: function (
    CFIStepValue,
    $currNode,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $elementsWithoutMarkers;
    var currTextNodePosition;
    var logicalTargetPosition;
    var nodeNum;
    var $targetTextNodeList;

    // Remove any cfi marker elements from the set of elements.
    // Rationale: A filtering function is used, as simply using a class selector with jquery appears to
    //   result in behaviour where text nodes are also filtered out, along with the class element being filtered.
    $elementsWithoutMarkers = this.applyBlacklist(
      $currNode.contents(),
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );

    // Convert CFIStepValue to logical index; assumes odd integer for the step value
    logicalTargetPosition = (parseInt(CFIStepValue) + 1) / 2;

    // Set text node position counter
    currTextNodePosition = 1;
    $targetTextNodeList = $elementsWithoutMarkers.filter(function () {
      if (currTextNodePosition === logicalTargetPosition) {
        // If it's a text node
        if (this.nodeType === 3) {
          return true;
        }
        // Any other type of node, move onto the next text node
        else {
          currTextNodePosition++;
          return false;
        }
      }
      // In this case, don't return any elements
      else {
        // If its the last child and it's not a text node, there are no text nodes after it
        // and the currTextNodePosition shouldn't be incremented
        if (this.nodeType !== 3 && this !== $elementsWithoutMarkers.lastChild) {
          currTextNodePosition++;
        }

        return false;
      }
    });

    // The filtering above should have counted the number of "logical" text nodes; this can be used to
    // detect out of range errors
    if ($targetTextNodeList.length === 0) {
      throw OutOfRangeError(
        logicalTargetPosition,
        currTextNodePosition - 1,
        "Index out of range"
      );
    }

    // return the text node list
    return $targetTextNodeList;
  },

  applyBlacklist: function (
    $elements,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $filteredElements;

    $filteredElements = $elements.filter(function () {
      var $currElement = $(this);
      var includeInList = true;

      if (classBlacklist) {
        // Filter each element with the class type
        $.each(classBlacklist, function (index, value) {
          if ($currElement.hasClass(value)) {
            includeInList = false;

            // Break this loop
            return false;
          }
        });
      }

      if (elementBlacklist) {
        // For each type of element
        $.each(elementBlacklist, function (index, value) {
          if ($currElement.is(value)) {
            includeInList = false;

            // Break this loop
            return false;
          }
        });
      }

      if (idBlacklist) {
        // For each type of element
        $.each(idBlacklist, function (index, value) {
          if ($currElement.attr("id") === value) {
            includeInList = false;

            // Break this loop
            return false;
          }
        });
      }

      return includeInList;
    });

    return $filteredElements;
  },
};

const Generator = {
  // ------------------------------------------------------------------------------------ //
  //  "PUBLIC" METHODS (THE API)                                                          //
  // ------------------------------------------------------------------------------------ //

  // Description: Generates a character offset CFI
  // Arguments: The text node that contains the offset referenced by the cfi, the offset value, the name of the
  //   content document that contains the text node, the package document for this EPUB.
  generateCharacterOffsetCFIComponent: function (
    startTextNode,
    characterOffset,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var textNodeStep;
    var contentDocCFI;
    var $itemRefStartNode;
    var packageDocCFI;

    this.validateStartTextNode(startTextNode, characterOffset);

    // Create the text node step
    textNodeStep = this.createCFITextNodeStep(
      $(startTextNode),
      characterOffset,
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );

    // Call the recursive method to create all the steps up to the head element of the content document (the "html" element)
    contentDocCFI =
      this.createCFIElementSteps(
        $(startTextNode).parent(),
        "html",
        classBlacklist,
        elementBlacklist,
        idBlacklist
      ) + textNodeStep;
    return contentDocCFI;
  },

  generateElementCFIComponent: function (
    startElement,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var contentDocCFI;
    var $itemRefStartNode;
    var packageDocCFI;

    // Call the recursive method to create all the steps up to the head element of the content document (the "html" element)
    contentDocCFI = this.createCFIElementSteps(
      $(startElement),
      "html",
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );
    return contentDocCFI;
  },

//   generatePackageDocumentCFIComponent: function (
//     contentDocumentName,
//     packageDocument,
//     classBlacklist,
//     elementBlacklist,
//     idBlacklist
//   ) {
//     this.validateContentDocumentName(contentDocumentName);
//     this.validatePackageDocument(packageDocument, contentDocumentName);

//     // Get the start node (itemref element) that references the content document
//     $itemRefStartNode = $(
//       "itemref[idref='" + contentDocumentName + "']",
//       $(packageDocument)
//     );

//     // Create the steps up to the top element of the package document (the "package" element)
//     packageDocCFIComponent = this.createCFIElementSteps(
//       $itemRefStartNode,
//       "package",
//       classBlacklist,
//       elementBlacklist,
//       idBlacklist
//     );
//     return packageDocCFIComponent;
//   },

  generateCompleteCFI: function (
    packageDocumentCFIComponent,
    contentDocumentCFIComponent
  ) {
    return (
      "epubcfi(" +
      packageDocumentCFIComponent +
      contentDocumentCFIComponent +
      ")"
    );
  },

  // ------------------------------------------------------------------------------------ //
  //  "PRIVATE" HELPERS                                                                   //
  // ------------------------------------------------------------------------------------ //

  validateStartTextNode: function (startTextNode, characterOffset) {
    // Check that the text node to start from IS a text node
    if (!startTextNode) {
      throw new NodeTypeError(
        startTextNode,
        "Cannot generate a character offset from a starting point that is not a text node"
      );
    } else if (startTextNode.nodeType != 3) {
      throw new NodeTypeError(
        startTextNode,
        "Cannot generate a character offset from a starting point that is not a text node"
      );
    }

    // Check that the character offset is within a valid range for the text node supplied
    if (characterOffset < 0) {
      throw new OutOfRangeError(
        characterOffset,
        0,
        "Character offset cannot be less than 0"
      );
    } else if (characterOffset > startTextNode.nodeValue.length) {
      throw new OutOfRangeError(
        characterOffset,
        startTextNode.nodeValue.length - 1,
        "character offset cannot be greater than the length of the text node"
      );
    }
  },

  validateContentDocumentName: function (contentDocumentName) {
    // Check that the idref for the content document has been provided
    if (!contentDocumentName) {
      throw new Error(
        "The idref for the content document, as found in the spine, must be supplied"
      );
    }
  },

  validatePackageDocument: function (packageDocument, contentDocumentName) {
    // Check that the package document is non-empty and contains an itemref element for the supplied idref
    if (!packageDocument) {
      throw new Error("A package document must be supplied to generate a CFI");
    } else if (
      $($("itemref[idref='" + contentDocumentName + "']", packageDocument)[0])
        .length === 0
    ) {
      throw new Error(
        "The idref of the content document could not be found in the spine"
      );
    }
  },

  // Description: Creates a CFI terminating step, to a text node, with a character offset
  // REFACTORING CANDIDATE: Some of the parts of this method could be refactored into their own methods
  createCFITextNodeStep: function (
    $startTextNode,
    characterOffset,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $parentNode;
    var $contentsExcludingMarkers;
    var CFIIndex;
    var indexOfTextNode;
    var preAssertion;
    var preAssertionStartIndex;
    var textLength;
    var postAssertion;
    var postAssertionEndIndex;

    // Find text node position in the set of child elements, ignoring any blacklisted elements
    $parentNode = $startTextNode.parent();
    $contentsExcludingMarkers = CFIInstructions.applyBlacklist(
      $parentNode.contents(),
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );

    // Find the text node index in the parent list, inferring nodes that were originally a single text node
    var prevNodeWasTextNode;
    var indexOfFirstInSequence;
    $.each($contentsExcludingMarkers, function (index) {
      // If this is a text node, check if it matches and return the current index
      if (this.nodeType === 3) {
        if (this === $startTextNode[0]) {
          // Set index as the first in the adjacent sequence of text nodes, or as the index of the current node if this
          //   node is a standard one sandwiched between two element nodes.
          if (prevNodeWasTextNode) {
            indexOfTextNode = indexOfFirstInSequence;
          } else {
            indexOfTextNode = index;
          }

          // Break out of .each loop
          return false;
        }

        // Save this index as the first in sequence of adjacent text nodes, if it is not already set by this point
        prevNodeWasTextNode = true;
        if (!indexOfFirstInSequence) {
          indexOfFirstInSequence = index;
        }
      }
      // This node is not a text node
      else {
        prevNodeWasTextNode = false;
        indexOfFirstInSequence = undefined;
      }
    });

    // Convert the text node index to a CFI odd-integer representation
    CFIIndex = indexOfTextNode * 2 + 1;

    // TODO: text assertions are not in the grammar yet, I think, or they're just causing problems. This has
    //   been temporarily removed.

    // Add pre- and post- text assertions
    // preAssertionStartIndex = (characterOffset - 3 >= 0) ? characterOffset - 3 : 0;
    // preAssertion = $startTextNode[0].nodeValue.substring(preAssertionStartIndex, characterOffset);

    // textLength = $startTextNode[0].nodeValue.length;
    // postAssertionEndIndex = (characterOffset + 3 <= textLength) ? characterOffset + 3 : textLength;
    // postAssertion = $startTextNode[0].nodeValue.substring(characterOffset, postAssertionEndIndex);

    // Gotta infer the correct character offset, as well

    // Return the constructed CFI text node step
    return "/" + CFIIndex + ":" + characterOffset;
    // + "[" + preAssertion + "," + postAssertion + "]";
  },

  // Description: A set of adjacent text nodes can be inferred to have been a single text node in the original document. As such,
  //   if the character offset is specified for one of the adjacent text nodes, the true offset for the original node must be
  //   inferred.
  findOriginalTextNodeCharOffset: function (
    $startTextNode,
    specifiedCharacterOffset,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $parentNode;
    var $contentsExcludingMarkers;
    var textLength;

    // Find text node position in the set of child elements, ignoring any cfi markers
    $parentNode = $startTextNode.parent();
    $contentsExcludingMarkers = CFIInstructions.applyBlacklist(
      $parentNode.contents(),
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );

    // Find the text node number in the list, inferring nodes that were originally a single text node
    var prevNodeWasTextNode;
    var originalCharOffset = -1; // So the character offset is a 0-based index; we'll be adding lengths of text nodes to this number
    $.each($contentsExcludingMarkers, function (index) {
      // If this is a text node, check if it matches and return the current index
      if (this.nodeType === 3) {
        if (this === $startTextNode[0]) {
          if (prevNodeWasTextNode) {
            originalCharOffset = originalCharOffset + specifiedCharacterOffset;
          } else {
            originalCharOffset = specifiedCharacterOffset;
          }

          return false; // Break out of .each loop
        } else {
          originalCharOffset = originalCharOffset + this.length;
        }

        // save this index as the first in sequence of adjacent text nodes, if not set
        prevNodeWasTextNode = true;
      }
      // This node is not a text node
      else {
        prevNodeWasTextNode = false;
      }
    });

    return originalCharOffset;
  },

  createCFIElementSteps: function (
    $currNode,
    topLevelElement,
    classBlacklist,
    elementBlacklist,
    idBlacklist
  ) {
    var $blacklistExcluded;
    var $parentNode;
    var currNodePosition;
    var CFIPosition;
    var idAssertion;
    var elementStep;

    // Find position of current node in parent list
    $blacklistExcluded = CFIInstructions.applyBlacklist(
      $currNode.parent().children(),
      classBlacklist,
      elementBlacklist,
      idBlacklist
    );
    $.each($blacklistExcluded, function (index, value) {
      if (this === $currNode[0]) {
        currNodePosition = index;

        // Break loop
        return false;
      }
    });

    // Convert position to the CFI even-integer representation
    CFIPosition = (currNodePosition + 1) * 2;

    // Create CFI step with id assertion, if the element has an id
    if ($currNode.attr("id")) {
      elementStep = "/" + CFIPosition + "[" + $currNode.attr("id") + "]";
    } else {
      elementStep = "/" + CFIPosition;
    }

    // If a parent is an html element return the (last) step for this content document, otherwise, continue.
    //   Also need to check if the current node is the top-level element. This can occur if the start node is also the
    //   top level element.
    $parentNode = $currNode.parent();
    if ($parentNode.is(topLevelElement) || $currNode.is(topLevelElement)) {
      // If the top level node is a type from which an indirection step, add an indirection step character (!)
      // REFACTORING CANDIDATE: It is possible that this should be changed to: if (topLevelElement = 'package') do
      //   not return an indirection character. Every other type of top-level element may require an indirection
      //   step to navigate to, thus requiring that ! is always prepended.
      if (topLevelElement === "html") {
        return "!" + elementStep;
      } else {
        return elementStep;
      }
    } else {
      return (
        this.createCFIElementSteps(
          $parentNode,
          topLevelElement,
          classBlacklist,
          elementBlacklist,
          idBlacklist
        ) + elementStep
      );
    }
  },
};

export { Generator };
