import { Question, Option, QuestionType } from './types';
import Papa from 'papaparse';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

export async function parseCsv(file: File): Promise<Question[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const questions: Question[] = results.data.map((row: any) => {
          // Use 'answers' column from export, fallback to 'options'
          const answersText = row.answers || row.options || '';
          const type = row.type || 'multiple-choice';
          
          let options: Option[] = [];
          let numericalAnswer: number | undefined;
          let numericalMargin: number | undefined;
          let acceptedAnswers: string[] = [];

          if (type === 'numerical-exact') {
             // Format: Answer: 5
             const match = answersText.match(/Answer:\s*([-]?[\d.]+)/);
             if (match) {
               numericalAnswer = parseFloat(match[1]);
             }
          } else if (type === 'numerical-margin') {
             // Format: Answer: 5 (Margin: 0.1)
             const match = answersText.match(/Answer:\s*([-]?[\d.]+)\s*\(Margin:\s*([\d.]+)\)/);
             if (match) {
               numericalAnswer = parseFloat(match[1]);
               numericalMargin = parseFloat(match[2]);
             }
          } else if (type === 'short-answer') {
             // Format: Accepted Answers: ans1 | ans2
             const prefix = "Accepted Answers:";
             if (answersText.startsWith(prefix)) {
                const text = answersText.substring(prefix.length).trim();
                acceptedAnswers = text.split('|').map((s: string) => s.trim()).filter((s: string) => s !== '');
             }
          } else {
             // Multiple choice, etc.
             if (answersText) {
               options = answersText.split('|').map((opt: string) => {
                const isCorrect = opt.includes('(Correct)');
                return {
                  id: uuidv4(),
                  text: opt.replace('(Correct)', '').replace('(Incorrect)', '').trim(),
                  isCorrect
                };
              });
             }
          }

          return {
            id: uuidv4(),
            title: row.title || 'Untitled Question',
            type: type,
            prompt: row.prompt || '',
            points: parseInt(row.points) || 1,
            options,
            numericalAnswer,
            numericalMargin,
            acceptedAnswers
          };
        });
        resolve(questions);
      },
      error: (error) => reject(error)
    });
  });
}

export async function parseWord(file: File): Promise<Question[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  let html = result.value;
  // Replace <br> with newlines to handle soft breaks within paragraphs
  html = html.replace(/<br\s*\/?>/gi, '\n');
  // Add newlines after block elements to ensure textContent separates them
  html = html.replace(/<\/(p|div|li|h[1-6]|tr|td|th|blockquote|pre)>/gi, '\n</$1>');
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const elements = Array.from(doc.body.children);
  const questions: Question[] = [];
  let currentQuestion: Partial<Question> | null = null;

  for (const element of elements) {
    // Check for images
    const img = element.querySelector('img');
    if (img && currentQuestion) {
      const src = img.getAttribute('src');
      if (src && src.startsWith('data:image')) {
        currentQuestion.imageUrl = src;
        // Generate a name from mime type
        const mimeType = src.split(';')[0].split(':')[1];
        const ext = mimeType.split('/')[1] || 'png';
        currentQuestion.imageName = `image-${Date.now()}.${ext}`;
      }
    }

    // Process text content
    const text = element.textContent || '';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');

    for (const line of lines) {
      if (line.match(/^Question \d+:/)) {
        if (currentQuestion) {
          questions.push(currentQuestion as Question);
        }
        currentQuestion = {
          id: uuidv4(),
          title: line.split(':')[1]?.trim() || 'Untitled',
          type: 'multiple-choice',
          options: [],
          points: 1,
          prompt: ''
        };
      } else if (currentQuestion) {
        if (line.startsWith('Prompt:')) {
          currentQuestion.prompt = line.replace('Prompt:', '').trim();
        } else if (line.startsWith('Type:')) {
          currentQuestion.type = line.replace('Type:', '').trim() as any;
        } else if (line.startsWith('Points:')) {
          currentQuestion.points = parseInt(line.replace('Points:', '').trim()) || 1;
        } else if (line.startsWith('Correct Answer:')) {
          const answerText = line.replace('Correct Answer:', '').trim();
          if (currentQuestion.type === 'numerical-exact') {
            currentQuestion.numericalAnswer = parseFloat(answerText);
          } else if (currentQuestion.type === 'numerical-margin') {
             // Format: "5 (Margin: 0.1)" or "-5 (Margin: 0.1)"
             const match = answerText.match(/^([-]?[\d.]+)\s*\(Margin:\s*([\d.]+)\)$/);
             if (match) {
               currentQuestion.numericalAnswer = parseFloat(match[1]);
               currentQuestion.numericalMargin = parseFloat(match[2]);
             } else {
               // Fallback if format is just number
               currentQuestion.numericalAnswer = parseFloat(answerText);
             }
          }
        } else if (line.startsWith('Accepted Answers:')) {
          const answersText = line.replace('Accepted Answers:', '').trim();
          if (currentQuestion.type === 'short-answer') {
            currentQuestion.acceptedAnswers = answersText.split(',').map(s => s.trim()).filter(s => s !== '');
          }
        } else if (line.match(/^\[[ x]\]/)) {
          const isCorrect = line.includes('[x]');
          const text = line.replace(/^\[[ x]\]/, '').trim();
          currentQuestion.options?.push({
            id: uuidv4(),
            text,
            isCorrect
          });
        }
      }
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion as Question);
  }

  return questions;
}

export async function parseQti(file: File): Promise<Question[]> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("imsmanifest.xml");
  
  if (!manifestFile) {
    throw new Error("Invalid QTI package: imsmanifest.xml not found");
  }

  const manifestXml = await manifestFile.async("string");
  const parser = new DOMParser();
  const manifestDoc = parser.parseFromString(manifestXml, "text/xml");
  
  const resources = Array.from(manifestDoc.getElementsByTagName("resource"));
  const itemResources = resources.filter(r => {
    const type = r.getAttribute("type");
    return type && (
      type.includes("imsqti_item_xml") || 
      type === "imsqti_item_xmlv2p2" || 
      type === "imsqti_item_xmlv3p0" ||
      type === "imsqti_xmlv1p2"
    );
  });

  const questions: Question[] = [];

  for (const resource of itemResources) {
    let href = resource.getAttribute("href");
    
    // If href is not on the resource element, check for a child <file> element
    if (!href) {
      const fileElement = resource.getElementsByTagName("file")[0];
      if (fileElement) {
        href = fileElement.getAttribute("href");
      }
    }

    if (!href) continue;

    const itemFile = zip.file(href);
    if (!itemFile) continue;

    const itemXml = await itemFile.async("string");
    const itemDoc = parser.parseFromString(itemXml, "text/xml");
    
    // Check for QTI 1.2
    const questestinterop = itemDoc.getElementsByTagName("questestinterop")[0];
    const items = itemDoc.getElementsByTagName("item");
    
    if (questestinterop || items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const id = uuidv4();
        const title = item.getAttribute("title") || "Untitled Question";
        
        // Get prompt
        const mattext = item.getElementsByTagName("mattext")[0];
        let prompt = mattext ? (mattext.textContent || "") : "";
        
        // Handle matimage (QTI 1.2 standard way for images)
        const matimage = item.getElementsByTagName("matimage")[0];
        let imageUrl: string | undefined;
        let imageName: string | undefined;

        if (matimage) {
          const uri = matimage.getAttribute("uri");
          if (uri) {
             // Try to find file in zip
             let imageFile = zip.file(uri);
             if (!imageFile) {
                try { imageFile = zip.file(decodeURIComponent(uri)); } catch(e) {}
             }
             
             if (imageFile) {
               imageName = uri.split('/').pop() || "image.png";
               const base64 = await imageFile.async("base64");
               const ext = imageName.split('.').pop()?.toLowerCase();
               const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/gif';
               imageUrl = `data:${mimeType};base64,${base64}`;
             }
          }
        }

        // Handle images in QTI 1.2 prompt
        // Replace $IMS-CC-FILEBASE$ and remove query params
        prompt = prompt.replace(/\$IMS-CC-FILEBASE\$\//g, '').replace(/\?canvas_download=1/g, '');
        
        // Extract images and replace with base64 if found in zip
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = prompt;
        const imgs = tempDiv.getElementsByTagName('img');
        
        for (let j = 0; j < imgs.length; j++) {
          const img = imgs[j];
          const src = img.getAttribute('src');
          if (src) {
            // Try to find file in zip
            // The src might be relative or absolute path within zip
            let imageFile = zip.file(src);
            if (!imageFile) {
               // Try decoding
               try { imageFile = zip.file(decodeURIComponent(src)); } catch(e) {}
            }
            
            if (imageFile) {
               const base64 = await imageFile.async("base64");
               const ext = src.split('.').pop()?.toLowerCase() || 'png';
               const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/gif';
               img.setAttribute('src', `data:${mimeType};base64,${base64}`);
            }
          }
        }
        prompt = tempDiv.innerHTML;

        // Get options
        const responseLabels = item.getElementsByTagName("response_label");
        const options: Option[] = [];
        for (let j = 0; j < responseLabels.length; j++) {
          const label = responseLabels[j];
          const optId = label.getAttribute("ident") || uuidv4();
          const optText = label.getElementsByTagName("mattext")[0]?.textContent || "";
          options.push({
            id: optId,
            text: optText,
            isCorrect: false
          });
        }

        // Determine type and correct answer
        let type: QuestionType = 'multiple-choice';
        let points = 1;
        let numericalAnswer: number | undefined;
        let numericalMargin: number | undefined;
        let acceptedAnswers: string[] = [];

        const presentation = item.getElementsByTagName("presentation")[0];
        const resprocessing = item.getElementsByTagName("resprocessing")[0];

        if (presentation) {
            const responseLid = presentation.getElementsByTagName("response_lid")[0];
            const responseStr = presentation.getElementsByTagName("response_str")[0];
            const responseNum = presentation.getElementsByTagName("response_num")[0];

            if (responseLid) {
                const rcardinality = responseLid.getAttribute("rcardinality");
                if (rcardinality === "Multiple") {
                    type = "multiple-answer";
                } else {
                    // Check for True/False
                    let hasTrue = false;
                    let hasFalse = false;
                    for(let k=0; k<options.length; k++) {
                        const txt = options[k].text.toLowerCase();
                        if (txt === 'true') hasTrue = true;
                        if (txt === 'false') hasFalse = true;
                    }
                    if (hasTrue && hasFalse && options.length === 2) {
                        type = "true-false";
                    } else {
                        type = "multiple-choice";
                    }
                }
            } else if (responseNum) {
                // Default to numerical-exact, might be updated to numerical-margin in resprocessing
                type = "numerical-exact";
            } else if (responseStr) {
                // Check if there are correct answers in resprocessing to distinguish essay vs short-answer
                let hasCorrectAnswers = false;
                if (resprocessing) {
                    const varequal = resprocessing.getElementsByTagName("varequal");
                    if (varequal.length > 0) hasCorrectAnswers = true;
                }
                
                if (hasCorrectAnswers) {
                    type = "short-answer";
                } else {
                    type = "essay";
                }
            }
        }

        // Process resprocessing for correct answers and points
        if (resprocessing) {
            const respconditions = resprocessing.getElementsByTagName("respcondition");
            for (let j = 0; j < respconditions.length; j++) {
                const cond = respconditions[j];
                const setvar = cond.getElementsByTagName("setvar")[0];
                const pointsVal = parseFloat(setvar?.textContent || "0");
                
                if (setvar && pointsVal > 0) {
                    // This condition awards points
                    // Use the highest points found as the question points (simplification)
                    if (pointsVal > points) points = pointsVal;

                    // Check for numerical-margin (range)
                    const conditionvar = cond.getElementsByTagName("conditionvar")[0];
                    if (conditionvar) {
                        const andBlock = conditionvar.getElementsByTagName("and")[0];
                        if (andBlock) {
                            const vargte = andBlock.getElementsByTagName("vargte")[0] || andBlock.getElementsByTagName("vargt")[0];
                            const varlte = andBlock.getElementsByTagName("varlte")[0] || andBlock.getElementsByTagName("varlt")[0];
                            
                            if (vargte && varlte) {
                                const lower = parseFloat(vargte.textContent || "0");
                                const upper = parseFloat(varlte.textContent || "0");
                                
                                type = 'numerical-margin';
                                numericalAnswer = (upper + lower) / 2;
                                numericalMargin = (upper - lower) / 2;
                                continue; // Skip varequal check
                            }
                        }
                    }

                    const varequal = cond.getElementsByTagName("varequal");
                    for (let k = 0; k < varequal.length; k++) {
                        const val = varequal[k].textContent || "";
                        
                        if (type === 'multiple-choice' || type === 'true-false' || type === 'multiple-answer') {
                            const opt = options.find(o => o.id === val);
                            if (opt) opt.isCorrect = true;
                        } else if (type === 'numerical-exact') {
                            numericalAnswer = parseFloat(val);
                        } else if (type === 'short-answer') {
                            acceptedAnswers.push(val);
                        }
                    }
                }
            }
        }

        questions.push({
          id,
          title,
          type,
          prompt,
          options,
          points,
          imageUrl,
          imageName,
          numericalAnswer,
          numericalMargin,
          acceptedAnswers
        });
      }
      continue;
    }

    const assessmentItem = itemDoc.getElementsByTagName("assessmentItem")[0];
    if (!assessmentItem) continue;

    const title = assessmentItem.getAttribute("title") || "Untitled Question";
    const id = uuidv4();
    
    let type: QuestionType = 'multiple-choice';
    const choiceInteraction = itemDoc.getElementsByTagName("choiceInteraction")[0];
    const extendedTextInteraction = itemDoc.getElementsByTagName("extendedTextInteraction")[0];
    const textEntryInteraction = itemDoc.getElementsByTagName("textEntryInteraction")[0];
    
    let prompt = "";
    let options: Option[] = [];
    let points = 0;
    let numericalAnswer: number | undefined;
    let numericalMargin: number | undefined;
    let acceptedAnswers: string[] = [];
    let imageUrl: string | undefined;
    let imageName: string | undefined;

    // Check for images in itemBody
    const imgTag = itemDoc.getElementsByTagName("img")[0];
    if (imgTag) {
      const src = imgTag.getAttribute("src");
      if (src) {
        // Try to find the image file in the zip
        let imageFile = zip.file(src);
        
        // If not found and we have a directory structure, try relative path
        if (!imageFile && href.includes('/')) {
            const currentDir = href.substring(0, href.lastIndexOf('/'));
            // Handle simple relative path (no .. support for now, just current dir)
            const relativePath = `${currentDir}/${src}`;
            imageFile = zip.file(relativePath);
        }

        // Check if the src is actually encoded (e.g. %20)
        if (!imageFile) {
             try {
                 imageFile = zip.file(decodeURIComponent(src));
             } catch (e) {
                 // ignore
             }
        }

        if (imageFile) {
          imageName = src.split('/').pop() || "image.png";
          const base64 = await imageFile.async("base64");
          // Try to guess mime type from extension
          const ext = imageName.split('.').pop()?.toLowerCase();
          const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/gif';
          imageUrl = `data:${mimeType};base64,${base64}`;
        }
      }
    }

    // Get points
    const outcomeDecl = Array.from(itemDoc.getElementsByTagName("outcomeDeclaration"))
      .find(od => od.getAttribute("identifier") === "SCORE");
    
    if (outcomeDecl) {
        const defaultValue = outcomeDecl.getElementsByTagName("defaultValue")[0];
        if (defaultValue) {
            const value = defaultValue.getElementsByTagName("value")[0];
            if (value) {
                points = parseFloat(value.textContent || "0");
            }
        }
    }
    
    // Get correct response
    const responseDecl = Array.from(itemDoc.getElementsByTagName("responseDeclaration"))
        .find(rd => rd.getAttribute("identifier") === "RESPONSE");
    
    let correctResponseValues: string[] = [];
    if (responseDecl) {
        const correctResponse = responseDecl.getElementsByTagName("correctResponse")[0];
        if (correctResponse) {
            const values = correctResponse.getElementsByTagName("value");
            for (let i = 0; i < values.length; i++) {
                correctResponseValues.push(values[i].textContent || "");
            }
        }
        
        if (points === 0) {
            const mapping = responseDecl.getElementsByTagName("mapping")[0];
            if (mapping) {
                const mapEntries = mapping.getElementsByTagName("mapEntry");
                if (mapEntries.length > 0) {
                     const mappedValue = mapEntries[0].getAttribute("mappedValue");
                     if (mappedValue) points = parseFloat(mappedValue);
                }
            }
        }
    }

    if (extendedTextInteraction) {
        type = 'essay';
        const promptEl = extendedTextInteraction.getElementsByTagName("prompt")[0];
        if (promptEl) prompt = promptEl.textContent || "";
    } else if (textEntryInteraction) {
        // Try to find prompt in <prompt> tag inside interaction first
        const internalPrompt = textEntryInteraction.getElementsByTagName("prompt")[0];
        if (internalPrompt && internalPrompt.textContent?.trim()) {
            prompt = internalPrompt.textContent.trim();
        } else {
            // Fallback: Extract text from itemBody, excluding the interaction itself and images
            // This handles cases where prompt is in <p>, <div>, or just text node
            const itemBody = itemDoc.getElementsByTagName("itemBody")[0];
            if (itemBody) {
                 const clone = itemBody.cloneNode(true) as Element;
                 
                 // Remove the interaction elements
                 const interactions = clone.getElementsByTagName("textEntryInteraction");
                 while (interactions.length > 0) {
                     interactions[0].parentNode?.removeChild(interactions[0]);
                 }
                 
                 // Remove images
                 const images = clone.getElementsByTagName("img");
                 while (images.length > 0) {
                     images[0].parentNode?.removeChild(images[0]);
                 }
                 
                 if (clone.textContent && clone.textContent.trim().length > 0) {
                     prompt = clone.textContent.trim();
                 }
            }
        }
        
        const baseType = responseDecl?.getAttribute("baseType");
        
        if (baseType === "float") {
            if (itemXml.includes("Margin:")) {
                type = 'numerical-margin';
                // Try to extract margin from comment if we saved it there
                const match = itemXml.match(/Margin: ([\d.]+)/);
                if (match) numericalMargin = parseFloat(match[1]);
            } else {
                type = 'numerical-exact';
            }
            if (correctResponseValues.length > 0) {
                numericalAnswer = parseFloat(correctResponseValues[0]);
            }
        } else {
            type = 'short-answer';
            acceptedAnswers = correctResponseValues;
        }

    } else if (choiceInteraction) {
        const promptEl = choiceInteraction.getElementsByTagName("prompt")[0];
        if (promptEl) prompt = promptEl.textContent || "";
        
        const maxChoices = parseInt(choiceInteraction.getAttribute("maxChoices") || "1");
        const simpleChoices = choiceInteraction.getElementsByTagName("simpleChoice");
        
        for (let i = 0; i < simpleChoices.length; i++) {
            const choice = simpleChoices[i];
            const choiceId = choice.getAttribute("identifier") || uuidv4();
            const choiceText = choice.textContent?.trim() || "";
            const isCorrect = correctResponseValues.includes(choiceId);
            
            options.push({
                id: choiceId,
                text: choiceText,
                isCorrect
            });
        }

        if (options.length === 2 && 
            options.some(o => o.text.toLowerCase() === 'true') && 
            options.some(o => o.text.toLowerCase() === 'false')) {
            type = 'true-false';
        } else if (maxChoices !== 1 || correctResponseValues.length > 1) {
            type = 'multiple-answer';
        } else {
            type = 'multiple-choice';
        }
    }

    questions.push({
        id,
        title,
        type,
        prompt,
        options,
        points: points || 1,
        imageUrl,
        imageName,
        numericalAnswer,
        numericalMargin,
        acceptedAnswers
    });
  }

  return questions;
}
