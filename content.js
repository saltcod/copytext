// Content script for CopyText extension
(function() {
  'use strict';

  // Check if we have a configuration for this site
  const siteConfig = getConfigForCurrentSite();
  if (!siteConfig) {
    return; // No configuration for this site
  }

  // Create copy button element
  function createCopyButton() {
    const button = document.createElement('button');
    button.className = 'copytext-button';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.5 2.5h7v9h-7v-9z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M3.5 4.5v9h7" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    `;
    button.title = 'Copy content';
    return button;
  }

  // Remove classes from HTML element and its children
  function stripClasses(element) {
    const cloned = element.cloneNode(true);
    
    // Remove all class attributes
    cloned.removeAttribute('class');
    
    // Remove classes from all child elements
    const allElements = cloned.querySelectorAll('*');
    allElements.forEach(el => {
      el.removeAttribute('class');
    });
    
    return cloned;
  }

  // Convert HTML to Markdown-like format
  function htmlToMarkdown(element) {
    const cleaned = stripClasses(element);
    let markdown = '';
    
    function processNode(node, listLevel = 0) {
      const indent = '  '.repeat(listLevel);
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) markdown += text;
        return;
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      
      const tag = node.tagName.toLowerCase();
      
      switch (tag) {
        case 'h1':
          markdown += '\n# ' + node.textContent.trim() + '\n\n';
          break;
        case 'h2':
          markdown += '\n## ' + node.textContent.trim() + '\n\n';
          break;
        case 'h3':
          markdown += '\n### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h4':
          markdown += '\n#### ' + node.textContent.trim() + '\n\n';
          break;
        case 'p':
          Array.from(node.childNodes).forEach(child => processNode(child, listLevel));
          markdown += '\n\n';
          break;
        case 'pre':
        case 'code':
          const code = node.textContent;
          if (tag === 'pre' || node.parentElement?.tagName !== 'PRE') {
            markdown += '\n```\n' + code + '\n```\n\n';
          } else {
            markdown += code;
          }
          break;
        case 'ul':
        case 'ol':
          Array.from(node.children).forEach((li, index) => {
            const bullet = tag === 'ul' ? '- ' : `${index + 1}. `;
            markdown += indent + bullet;
            Array.from(li.childNodes).forEach(child => processNode(child, listLevel + 1));
            markdown += '\n';
          });
          markdown += '\n';
          break;
        case 'strong':
        case 'b':
          markdown += '**' + node.textContent + '**';
          break;
        case 'em':
        case 'i':
          markdown += '_' + node.textContent + '_';
          break;
        case 'a':
          markdown += '[' + node.textContent + '](' + node.href + ')';
          break;
        case 'br':
          markdown += '\n';
          break;
        default:
          Array.from(node.childNodes).forEach(child => processNode(child, listLevel));
          break;
      }
    }
    
    processNode(cleaned);
    return markdown.trim();
  }

  // Copy to clipboard
  async function copyToClipboard(element) {
    try {
      // Convert to markdown
      const markdown = htmlToMarkdown(element);
      
      // Also keep cleaned HTML
      const cleaned = stripClasses(element);
      const html = cleaned.innerHTML;
      
      // Copy markdown as plain text and HTML
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([markdown], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
      console.log('Copied as markdown:', markdown);
      return true;
    } catch (err) {
      // Fallback to plain text
      try {
        const markdown = htmlToMarkdown(element);
        await navigator.clipboard.writeText(markdown);
        console.log('Copied as markdown (fallback):', markdown);
        return true;
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr);
        return false;
      }
    }
  }

  // Show feedback on button
  function showCopyFeedback(button, success = true) {
    const originalHTML = button.innerHTML;
    
    if (success) {
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
      `;
      button.classList.add('copytext-button-success');
    } else {
      button.innerHTML = '✕';
      button.classList.add('copytext-button-error');
    }

    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('copytext-button-success', 'copytext-button-error');
    }, 2000);
  }

  // Add copy button to an element
  function addCopyButton(element) {
    // Skip if button already exists
    if (element.querySelector('.copytext-button')) {
      return;
    }

    // Create wrapper if element doesn't have position relative/absolute
    const computedStyle = window.getComputedStyle(element);
    const position = computedStyle.position;
    
    if (position === 'static') {
      element.style.position = 'relative';
    }

    const button = createCopyButton();
    
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const success = await copyToClipboard(element);
      showCopyFeedback(button, success);
    });

    element.appendChild(button);
  }

  // Find and process all matching elements
  function processElements() {
    siteConfig.selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          addCopyButton(element);
        });
      } catch (err) {
        console.error(`Error processing selector "${selector}":`, err);
      }
    });
  }

  // Initial processing
  processElements();

  // Watch for dynamically added content
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    
    if (shouldProcess) {
      processElements();
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('CopyText extension activated for', window.location.hostname);
})();
