import { Question, QtiVersion } from './types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const QTI_2_2_NS = "http://www.imsglobal.org/xsd/imsqti_v2p2";
const QTI_3_0_NS = "http://www.imsglobal.org/xsd/imsqti_v3p0";

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function generateManifest(questions: Question[], version: QtiVersion): string {
  let schemaLocation = "";
  if (version === '3.0') {
    schemaLocation = "http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://www.imsglobal.org/xsd/imsmd_v1p2 http://www.imsglobal.org/xsd/imsmd_v1p2p4.xsd http://www.imsglobal.org/xsd/imsqti_v3p0 http://www.imsglobal.org/xsd/imsqti_v3p0.xsd";
  } else if (version === '2.2') {
    schemaLocation = "http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd http://www.imsglobal.org/xsd/imsmd_v1p2 http://www.imsglobal.org/xsd/imsmd_v1p2p4.xsd http://www.imsglobal.org/xsd/imsqti_v2p2 http://www.imsglobal.org/xsd/imsqti_v2p2.xsd";
  } else {
    // 1.2
    schemaLocation = "http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.imsglobal.org/xsd/imsqti_v1p2 http://www.imsglobal.org/xsd/imsqti_v1p2.xsd";
  }

  const resources = questions.map(q => {
    let fileRefs = `<file href="${q.id}.xml"/>`;
    if (q.imageUrl && q.imageName) {
      fileRefs += `\n      <file href="images/${q.imageName}"/>`;
    }
    
    let resourceType = "";
    if (version === '3.0') resourceType = "imsqti_item_xmlv3p0";
    else if (version === '2.2') resourceType = "imsqti_item_xmlv2p2";
    else resourceType = "imsqti_item_xmlv1p2";

    return `
    <resource identifier="${q.id}" type="${resourceType}" href="${q.id}.xml">
      ${fileRefs}
    </resource>
  `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          identifier="MANIFEST-${new Date().getTime()}"
          xsi:schemaLocation="${schemaLocation}">
  <metadata>
    <schema>IMS Content</schema>
    <schemaversion>1.1</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    ${resources}
  </resources>
</manifest>`;
}

function generateAssessmentItem12(question: Question): string {
  let presentation = '';
  let resprocessing = '';
  
  // Image HTML
  let imageHtml = '';
  if (question.imageUrl && question.imageName) {
    const ext = question.imageName.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/gif');
    imageHtml = `<matimage uri="images/${escapeXml(question.imageName)}" label="Question Figure" imagtype="${mimeType}"/>`;
  }

  const promptMaterial = `
      <material>
        <mattext texttype="text/html">${escapeXml(question.prompt)}</mattext>
        ${imageHtml}
      </material>`;

  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    const correctOption = question.options.find(o => o.isCorrect);
    
    const responseLabels = question.options.map(opt => `
        <response_label ident="${opt.id}">
          <material>
            <mattext texttype="text/html">${escapeXml(opt.text)}</mattext>
          </material>
        </response_label>`).join('');

    presentation = `
    <presentation>
      ${promptMaterial}
      <response_lid ident="RESPONSE" rcardinality="Single">
        <render_choice shuffle="No">
          ${responseLabels}
        </render_choice>
      </response_lid>
    </presentation>`;

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
      <respcondition title="Correct">
        <conditionvar>
          <varequal respident="RESPONSE">${correctOption ? correctOption.id : ''}</varequal>
        </conditionvar>
        <setvar varname="SCORE" action="Set">${question.points}</setvar>
      </respcondition>
    </resprocessing>`;

  } else if (question.type === 'multiple-answer') {
    const correctOptions = question.options.filter(o => o.isCorrect);
    const pointsPerOption = question.points / (correctOptions.length || 1);

    const responseLabels = question.options.map(opt => `
        <response_label ident="${opt.id}">
          <material>
            <mattext texttype="text/html">${escapeXml(opt.text)}</mattext>
          </material>
        </response_label>`).join('');

    presentation = `
    <presentation>
      ${promptMaterial}
      <response_lid ident="RESPONSE" rcardinality="Multiple">
        <render_choice shuffle="No">
          ${responseLabels}
        </render_choice>
      </response_lid>
    </presentation>`;

    const conditions = correctOptions.map(opt => `
      <respcondition title="Correct-${opt.id}">
        <conditionvar>
          <varequal respident="RESPONSE">${opt.id}</varequal>
        </conditionvar>
        <setvar varname="SCORE" action="Add">${pointsPerOption}</setvar>
      </respcondition>`).join('\n');

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
      ${conditions}
    </resprocessing>`;

  } else if (question.type === 'essay') {
    presentation = `
    <presentation>
      ${promptMaterial}
      <response_str ident="RESPONSE" rcardinality="Single">
        <render_fib>
          <response_label ident="A"/>
        </render_fib>
      </response_str>
    </presentation>`;

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
    </resprocessing>`;

  } else if (question.type === 'numerical-exact') {
     presentation = `
    <presentation>
      ${promptMaterial}
      <response_num ident="RESPONSE" rcardinality="Single" numtype="Decimal">
        <render_fib fibtype="Decimal" columns="10">
          <response_label ident="A"/>
        </render_fib>
      </response_num>
    </presentation>`;

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
      <respcondition title="Correct">
        <conditionvar>
          <varequal respident="RESPONSE">${question.numericalAnswer ?? 0}</varequal>
        </conditionvar>
        <setvar varname="SCORE" action="Set">${question.points}</setvar>
      </respcondition>
    </resprocessing>`;

  } else if (question.type === 'numerical-margin') {
     const answer = question.numericalAnswer ?? 0;
     const margin = Math.abs(question.numericalMargin ?? 0);
     const lower = answer - margin;
     const upper = answer + margin;

     presentation = `
    <presentation>
      ${promptMaterial}
      <response_num ident="RESPONSE" rcardinality="Single" numtype="Decimal">
        <render_fib fibtype="Decimal" columns="10">
          <response_label ident="A"/>
        </render_fib>
      </response_num>
    </presentation>`;

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
      <respcondition title="Exact Match">
        <conditionvar>
          <varequal respident="RESPONSE">${answer}</varequal>
        </conditionvar>
        <setvar varname="SCORE" action="Set">${question.points}</setvar>
      </respcondition>
      <respcondition title="Range Match">
        <conditionvar>
          <and>
            <vargte respident="RESPONSE">${lower}</vargte>
            <varlte respident="RESPONSE">${upper}</varlte>
          </and>
        </conditionvar>
        <setvar varname="SCORE" action="Set">${question.points}</setvar>
      </respcondition>
    </resprocessing>`;

  } else if (question.type === 'short-answer') {
    presentation = `
    <presentation>
      ${promptMaterial}
      <response_str ident="RESPONSE" rcardinality="Single">
        <render_fib>
          <response_label ident="A"/>
        </render_fib>
      </response_str>
    </presentation>`;

    const conditions = (question.acceptedAnswers || []).map(ans => `
      <respcondition title="Correct">
        <conditionvar>
          <varequal respident="RESPONSE" case="No">${escapeXml(ans)}</varequal>
        </conditionvar>
        <setvar varname="SCORE" action="Set">${question.points}</setvar>
      </respcondition>`).join('\n');

    resprocessing = `
    <resprocessing>
      <outcomes>
        <decvar varname="SCORE" vartype="Decimal" defaultval="0"/>
      </outcomes>
      ${conditions}
    </resprocessing>`;
  }

  let itemMetadata = '';
  if (question.type === 'numerical-margin' || question.type === 'numerical-exact') {
      itemMetadata = `
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield>
            <fieldlabel>qmd_itemtype</fieldlabel>
            <fieldentry>Numerical</fieldentry>
          </qtimetadatafield>
        </qtimetadata>
      </itemmetadata>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
  <item ident="${question.id}" title="${escapeXml(question.title)}">
    ${itemMetadata}
    ${presentation}
    ${resprocessing}
  </item>
</questestinterop>`;
}

function generateAssessmentItem(question: Question, version: QtiVersion): string {
  const ns = version === '3.0' ? QTI_3_0_NS : QTI_2_2_NS;
  const schemaLocation = version === '3.0' 
    ? `${QTI_3_0_NS} http://www.imsglobal.org/xsd/imsqti_v3p0.xsd`
    : `${QTI_2_2_NS} http://www.imsglobal.org/xsd/imsqti_v2p2.xsd`;

  let responseDeclaration = '';
  let outcomeDeclaration = '';
  let itemBody = '';

  // Image HTML
  const imageHtml = (question.imageUrl && question.imageName) 
    ? `<p><img src="images/${escapeXml(question.imageName)}" alt="Question Figure"/></p>` 
    : '';

  // Outcome Declaration (Score)
  outcomeDeclaration = `
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>`;

  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    const correctOption = question.options.find(o => o.isCorrect);
    
    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse>
      <value>${correctOption ? correctOption.id : ''}</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="${correctOption ? correctOption.id : ''}" mappedValue="${question.points}"/>
    </mapping>
  </responseDeclaration>`;

    const choices = question.options.map(opt => `
      <simpleChoice identifier="${opt.id}">
        ${escapeXml(opt.text)}
      </simpleChoice>
    `).join('');

    itemBody = `
  <itemBody>
    ${imageHtml}
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <prompt>${escapeXml(question.prompt)}</prompt>
      ${choices}
    </choiceInteraction>
  </itemBody>`;

  } else if (question.type === 'multiple-answer') {
    const correctOptions = question.options.filter(o => o.isCorrect);
    const correctValues = correctOptions.map(o => `<value>${o.id}</value>`).join('\n      ');
    const mapEntries = correctOptions.map(o => `<mapEntry mapKey="${o.id}" mappedValue="${question.points / correctOptions.length}"/>`).join('\n      ');

    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
      ${correctValues}
    </correctResponse>
    <mapping defaultValue="0">
      ${mapEntries}
    </mapping>
  </responseDeclaration>`;

    const choices = question.options.map(opt => `
      <simpleChoice identifier="${opt.id}">
        ${escapeXml(opt.text)}
      </simpleChoice>
    `).join('');

    itemBody = `
  <itemBody>
    ${imageHtml}
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="0">
      <prompt>${escapeXml(question.prompt)}</prompt>
      ${choices}
    </choiceInteraction>
  </itemBody>`;

  } else if (question.type === 'essay') {
    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>`;

    itemBody = `
  <itemBody>
    ${imageHtml}
    <extendedTextInteraction responseIdentifier="RESPONSE">
      <prompt>${escapeXml(question.prompt)}</prompt>
    </extendedTextInteraction>
  </itemBody>`;

  } else if (question.type === 'numerical-exact') {
    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse>
      <value>${question.numericalAnswer ?? 0}</value>
    </correctResponse>
    <mapping defaultValue="0">
      <mapEntry mapKey="${question.numericalAnswer ?? 0}" mappedValue="${question.points}"/>
    </mapping>
  </responseDeclaration>`;

    itemBody = `
  <itemBody>
    ${imageHtml}
    <p>${escapeXml(question.prompt)}</p>
    <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/>
  </itemBody>`;

  } else if (question.type === 'numerical-margin') {
    // QTI uses areaMapping or specific range checks, but simple mapping is often exact.
    // For margin, we typically need to use areaMapping in QTI 2.2/3.0 or just define correctResponse.
    // However, standard simple mapping doesn't support ranges easily without complex responseProcessing.
    // We will use a simplified responseDeclaration that indicates the target value, 
    // but note that full margin support often requires custom responseProcessing templates.
    // For compatibility, we'll just set the correct response value.
    // A more advanced implementation would include responseProcessing.
    
    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse>
      <value>${question.numericalAnswer ?? 0}</value>
    </correctResponse>
  </responseDeclaration>`;

    // We add a comment about margin since standard mapping doesn't do ranges easily
    itemBody = `
  <itemBody>
    ${imageHtml}
    <!-- Margin: ${question.numericalMargin ?? 0} -->
    <p>${escapeXml(question.prompt)}</p>
    <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/>
  </itemBody>`;

  } else if (question.type === 'short-answer') {
    const correctValues = (question.acceptedAnswers || []).map(a => `<value>${escapeXml(a)}</value>`).join('\n      ');
    const mapEntries = (question.acceptedAnswers || []).map(a => `<mapEntry mapKey="${escapeXml(a)}" mappedValue="${question.points}"/>`).join('\n      ');

    responseDeclaration = `
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse>
      ${correctValues}
    </correctResponse>
    <mapping defaultValue="0">
      ${mapEntries}
    </mapping>
  </responseDeclaration>`;

    itemBody = `
  <itemBody>
    ${imageHtml}
    <p>${escapeXml(question.prompt)}</p>
    <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="20"/>
  </itemBody>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="${ns}"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xsi:schemaLocation="${schemaLocation}"
                identifier="${question.id}"
                title="${escapeXml(question.title)}"
                adaptive="false"
                timeDependent="false">
  ${responseDeclaration}
  ${outcomeDeclaration}
  ${itemBody}
</assessmentItem>`;
}

export async function exportQtiPackage(questions: Question[], version: QtiVersion) {
  const zip = new JSZip();
  
  // Add manifest
  zip.file("imsmanifest.xml", generateManifest(questions, version));

  // Add items and images
  questions.forEach(q => {
    if (version === '1.2') {
      zip.file(`${q.id}.xml`, generateAssessmentItem12(q));
    } else {
      zip.file(`${q.id}.xml`, generateAssessmentItem(q, version));
    }
    
    if (q.imageUrl && q.imageName) {
      // Convert data URL to blob/binary
      const base64Data = q.imageUrl.split(',')[1];
      if (base64Data) {
        zip.file(`images/${q.imageName}`, base64Data, { base64: true });
      }
    }
  });

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `qti-export-${version}.zip`);
}
