export * from './studentService';
export * from './teacherService';

// default aggregated export
import * as student from './studentService';
import * as teacher from './teacherService';

export const services = {
  student,
  teacher,
};

export default services;
