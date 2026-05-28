const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');

async function getAttendanceData(groupId = null) {
  let query = `
    SELECT u.full_name, u.group_name, a.date, a.status 
    FROM attendance a 
    JOIN users u ON a.student_id = u.id 
    WHERE u.role = 'student'
  `;
  const params = [];
  
  if (groupId) {
    query += ` AND u.group_name = $${params.length + 1}`;
    params.push(groupId);
  }
  
  query += ` ORDER BY u.group_name, a.date DESC`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = {
  async generateExcel(res, groupId = null) {
    const data = await getAttendanceData(groupId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Посещаемость');
    
    sheet.columns = [
      { header: 'ФИО', key: 'full_name', width: 30 },
      { header: 'Группа', key: 'group_name', width: 15 },
      { header: 'Дата', key: 'date', width: 12 },
      { header: 'Статус', key: 'status', width: 15 }
    ];
    
    sheet.addRows(data.map(row => ({
      ...row,
      date: new Date(row.date).toLocaleDateString('ru-RU')
    })));
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  },

  async generatePDF(res, groupId = null) {
    const data = await getAttendanceData(groupId);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${new Date().toISOString().split('T')[0]}.pdf`);
    
    doc.pipe(res);
    
    doc.fontSize(18).font('Helvetica-Bold').text('Отчет по посещаемости', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' });
    if (groupId) doc.text(`Группа: ${groupId}`, { align: 'center' });
    doc.moveDown(2);
    
    const startY = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('ФИО', 40, startY);
    doc.text('Группа', 250, startY);
    doc.text('Дата', 350, startY);
    doc.text('Статус', 450, startY);
    
    doc.moveTo(40, startY + 20).lineTo(550, startY + 20).stroke();
    
    doc.font('Helvetica');
    let y = startY + 25;
    
    data.forEach(row => {
      if (y > 750) { doc.addPage(); y = 40; }
      
      doc.text(row.full_name, 40, y, { width: 200 });
      doc.text(row.group_name || '-', 250, y, { width: 90 });
      doc.text(new Date(row.date).toLocaleDateString('ru-RU'), 350, y, { width: 90 });
      doc.text(row.status, 450, y, { width: 90 });
      
      y += 20;
      doc.moveTo(40, y).lineTo(550, y).stroke();
    });
    
    doc.end();
  }
};