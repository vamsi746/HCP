import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export async function generateDocument(action: any): Promise<string> {
  const uploadsDir = path.join(__dirname, '../../../uploads/documents');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.pdf`;
  const filepath = path.join(uploadsDir, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Header
    doc.fontSize(16).text('HYDERABAD CITY POLICE COMMISSIONERATE', { align: 'center' });
    doc.fontSize(10).text('SHIELD — Smart Hyderabad Integrated Enforcement & Law-enforcement Discipline', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Document type
    const isWarning = action.actionType === 'WARNING' || action.actionType === 'SHOW_CAUSE';
    const isSuspension = action.actionType === 'SUSPENSION';
    const title = isSuspension ? 'SUSPENSION ORDER' : isWarning ? 'WARNING LETTER' : `${action.actionType} NOTICE`;

    doc.fontSize(14).text(title, { align: 'center', underline: true });
    doc.moveDown();

    // Notice number & date
    doc.fontSize(11);
    doc.text(`Notice No: SHIELD/${action.actionType}/${action.actionNumber || 1}/${new Date().getFullYear()}`);
    doc.text(`Date: ${new Date(action.issuedAt).toLocaleDateString('en-IN')}`);
    doc.moveDown();

    // Addressed to
    doc.text('To,');
    doc.text(`${action.officerId?.name || 'N/A'}`);
    doc.text(`Badge No: ${action.officerId?.badgeNumber || 'N/A'}`);
    doc.text(`Rank: ${action.officerId?.rank || 'N/A'}`);
    doc.moveDown();

    // Body
    if (isWarning) {
      doc.text('Subject: Warning for failure to detect and act on illegal activity in assigned sector', { underline: true });
      doc.moveDown();
      doc.text('Sir/Madam,', { lineGap: 4 });
      doc.moveDown(0.5);
      doc.text(
        `It has come to the notice of this office that illegal activity (${action.violationId?.description || 'unlawful activity'}) was detected in your assigned sector area by the Task Force team, which should have been identified and acted upon by you during your routine patrols and monitoring duties.`,
        { lineGap: 3, align: 'justify' }
      );
      doc.moveDown();
      doc.text(
        `This is Warning #${action.actionNumber || 1} issued to you. You are hereby warned that continued dereliction of duty will result in stricter disciplinary action including suspension of service.`,
        { lineGap: 3, align: 'justify' }
      );
      doc.moveDown();
      doc.text(
        `You are directed to submit your written explanation within 7 days from the date of receipt of this notice.`,
        { lineGap: 3 }
      );
    } else if (isSuspension) {
      doc.text('Subject: Suspension order for repeated failure in duty', { underline: true });
      doc.moveDown();
      doc.text('Sir/Madam,', { lineGap: 4 });
      doc.moveDown(0.5);
      doc.text(
        `Despite prior warnings (Warning #1, #2), you have repeatedly failed to detect and prevent illegal activities in your assigned sector area. The Task Force team has continued to identify unlawful activities that fall under your jurisdiction.`,
        { lineGap: 3, align: 'justify' }
      );
      doc.moveDown();
      doc.text(
        `In light of the above, and under the provisions of the relevant service rules, you are hereby SUSPENDED from active duty effective immediately, pending a formal departmental enquiry.`,
        { lineGap: 3, align: 'justify' }
      );
    } else {
      doc.text(`Subject: ${action.actionType} Notice`, { underline: true });
      doc.moveDown();
      if (action.violationId) {
        doc.text(`Violation: ${action.violationId.violationType} — ${action.violationId.severity}`);
        doc.text(`Description: ${action.violationId.description || 'N/A'}`);
      }
    }

    if (action.responseDeadline) {
      doc.moveDown();
      doc.text(`Response Deadline: ${new Date(action.responseDeadline).toLocaleDateString('en-IN')}`, { bold: true });
    }

    // Signature block
    doc.moveDown(3);
    doc.text('By Order,', { align: 'right' });
    doc.moveDown();
    doc.fontSize(12).text('Commissioner of Police', { align: 'right' });
    doc.fontSize(11).text('Hyderabad City Police Commissionerate', { align: 'right' });
    doc.moveDown();
    doc.fontSize(9).text('(This is a system-generated document from SHIELD)', { align: 'center', oblique: true });

    doc.end();
    stream.on('finish', () => resolve(`/uploads/documents/${filename}`));
    stream.on('error', reject);
  });
}
