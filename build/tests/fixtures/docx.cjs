const AdmZip = require('adm-zip');

// A synthetic document; no Office installation or user files are needed.
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=';
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/';
const namespaces = `xmlns:w="${word}" xmlns:r="${relationships}" xmlns:wp="${drawing}wordprocessingDrawing"
  xmlns:a="${drawing}main" xmlns:pic="${drawing}picture"`;

function picture(id, linked = false) {
  return `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="${id}" descr="${id}"/>
    <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:${linked ? 'link' : 'embed'}="${id}"/>
    </pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

module.exports = function docxFixture(strict = false) {
  const parts = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="png" ContentType="image/png"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="document" Type="${relationships}/officeDocument" Target="word/document.xml"/>
      </Relationships>`,
    'word/document.xml': `<w:document ${namespaces}><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Document fixture ł</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold text</w:t></w:r></w:p>
      <w:p><w:r><w:t>Escaped &amp; &lt;literal&gt; 文書</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>List item</w:t></w:r></w:p>
      <w:p><w:bookmarkStart w:id="1" w:name="section"/><w:r><w:t>Bookmark</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p>
      <w:p><w:hyperlink w:anchor="section"><w:r><w:t>Internal link</w:t></w:r></w:hyperlink></w:p>
      <w:p><w:hyperlink r:id="unsafe"><w:r><w:t>Unsafe link</w:t></w:r></w:hyperlink></w:p>
      <w:p><w:hyperlink r:id="safe"><w:r><w:t>Safe link</w:t></w:r></w:hyperlink></w:p>
      <w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p>
      <w:moveFrom><w:p><w:r><w:t>Old revision</w:t></w:r></w:p></w:moveFrom>
      <w:moveTo><w:p><w:r><w:t>Moved revision</w:t></w:r></w:p></w:moveTo>
      <w:customXml><w:p><w:r><w:t>Custom XML text</w:t></w:r></w:p></w:customXml>
      ${picture('embedded')}${picture('linked', true)}${picture('remote', true)}
      </w:body></w:document>`,
    'word/styles.xml': `<w:styles xmlns:w="${word}">
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>`,
    'word/numbering.xml': `<w:numbering xmlns:w="${word}">
      <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
      <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
    'word/footnotes.xml': `<w:footnotes xmlns:w="${word}"><w:footnote w:id="1">
      <w:p><w:r><w:t>Footnote text</w:t></w:r></w:p></w:footnote></w:footnotes>`,
    'word/_rels/document.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="styles" Type="${relationships}/styles" Target="styles.xml"/>
      <Relationship Id="numbering" Type="${relationships}/numbering" Target="numbering.xml"/>
      <Relationship Id="footnotes" Type="${relationships}/footnotes" Target="footnotes.xml"/>
      <Relationship Id="unsafe" Type="${relationships}/hyperlink" Target="javascript:void(0)" TargetMode="External"/>
      <Relationship Id="safe" Type="${relationships}/hyperlink" Target="https://example.invalid/document" TargetMode="External"/>
      <Relationship Id="embedded" Type="${relationships}/image" Target="media/pixel.png"/>
      <Relationship Id="linked" Type="${relationships}/image" Target="linked.png" TargetMode="External"/>
      <Relationship Id="remote" Type="${relationships}/image" Target="https://example.invalid/remote.png" TargetMode="External"/>
      </Relationships>`,
  };
  const zip = new AdmZip();
  for (const [name, xml] of Object.entries(parts)) {
    const contents = strict
      ? xml.replace(
          /http:\/\/schemas.openxmlformats.org\/(wordprocessingml|drawingml|officeDocument)\/2006\//g,
          'http://purl.oclc.org/ooxml/$1/'
        )
      : xml;
    zip.addFile(name, Buffer.from(contents));
  }
  zip.addFile('word/media/pixel.png', Buffer.from(png, 'base64'));
  return zip;
};
module.exports.png = png;
