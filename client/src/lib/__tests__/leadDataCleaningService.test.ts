// Test file for lead data cleaning service
import { 
  cleanLeadData, 
  validateCleanedData, 
  LEAD_SOURCES, 
  COURSES, 
  LEAD_STATUSES,
  type LeadData 
} from '../leadDataCleaningService';

// Test data
const testLeadData: LeadData = {
  id: 'test-1',
  leadName: 'John Doe',
  contact: '9876543210',
  emailId: 'john@example.com',
  course: '2D Animation',
  source: 'Website',
  status: 'New',
  counselorName: 'Jane Smith',
  remark: 'Interested in animation course',
  cityArea: 'Mumbai',
  centreId: 'centre-1',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('Lead Data Cleaning Service', () => {
  test('should clean source field correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      source: 'website'
    });
    
    expect(result.cleanedData.source).toBe('Website Inquiry');
    expect(result.changes.source).toEqual({
      from: 'website',
      to: 'Website Inquiry'
    });
  });

  test('should clean course field correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      course: '2d animation'
    });
    
    expect(result.cleanedData.course).toBe('2D Animation');
    expect(result.changes.course).toEqual({
      from: '2d animation',
      to: '2D Animation'
    });
  });

  test('should clean status field correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      status: 'new'
    });
    
    expect(result.cleanedData.status).toBe('Not Contacted');
    expect(result.changes.status).toEqual({
      from: 'new',
      to: 'Not Contacted'
    });
  });

  test('should handle multiple courses correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      course: '2D Animation, 3D Animation'
    });
    
    expect(result.cleanedData.course).toBe('2D Animation');
  });

  test('should set default values for empty fields', () => {
    const result = cleanLeadData({
      ...testLeadData,
      source: '',
      course: '',
      status: ''
    });
    
    expect(result.cleanedData.source).toBe('Website Inquiry');
    expect(result.cleanedData.course).toBe('Not Sure');
    expect(result.cleanedData.status).toBe('Not Contacted');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('should validate cleaned data correctly', () => {
    const cleanedData = {
      ...testLeadData,
      source: 'Website Inquiry',
      course: '2D Animation',
      status: 'Not Contacted'
    };
    
    const validation = validateCleanedData(cleanedData);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should detect invalid data', () => {
    const invalidData = {
      ...testLeadData,
      leadName: '',
      contact: '',
      source: 'Invalid Source',
      course: 'Invalid Course',
      status: 'Invalid Status'
    };
    
    const validation = validateCleanedData(invalidData);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should clean phone numbers correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      contact: '+91 98765 43210'
    });
    
    expect(result.cleanedData.contact).toBe('+919876543210');
  });

  test('should clean email addresses correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      emailId: 'JOHN@EXAMPLE.COM'
    });
    
    expect(result.cleanedData.emailId).toBe('john@example.com');
  });

  test('should handle modular programs correctly', () => {
    const result = cleanLeadData({
      ...testLeadData,
      course: 'Adobe Photoshop'
    });
    
    expect(result.cleanedData.course).toBe('Adobe Photoshop');
  });
});

describe('Standardized Lists', () => {
  test('should have correct number of standardized sources', () => {
    expect(LEAD_SOURCES.length).toBe(16);
    expect(LEAD_SOURCES).toContain('Website Inquiry');
    expect(LEAD_SOURCES).toContain('Google Ad');
    expect(LEAD_SOURCES).toContain('Facebook');
  });

  test('should have correct number of standardized courses', () => {
    expect(COURSES.length).toBe(22); // 15 Zica + 7 Zima
    expect(COURSES).toContain('2D Animation');
    expect(COURSES).toContain('3D Animation');
    expect(COURSES).toContain('Film & TV Production');
  });

  test('should have correct number of standardized statuses', () => {
    expect(LEAD_STATUSES.length).toBe(8);
    expect(LEAD_STATUSES).toContain('Admission Done');
    expect(LEAD_STATUSES).toContain('Not Contacted');
    expect(LEAD_STATUSES).toContain('Placement');
    expect(LEAD_STATUSES).toContain('Job Seeker');
  });
});
