import { Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import PatientDetail from './pages/PatientDetail'
import Institutions from './pages/Institutions'
import InstitutionDetail from './pages/InstitutionDetail'
import Doctors from './pages/Doctors'
import DoctorDetail from './pages/DoctorDetail'
import Appointments from './pages/Appointments'
import AppointmentDetail from './pages/AppointmentDetail'
import Conditions from './pages/Conditions'
import ConditionDetail from './pages/ConditionDetail'
import Medications from './pages/Medications'
import MedicationDetail from './pages/MedicationDetail'
import Prescriptions from './pages/Prescriptions'
import PrescriptionDetail from './pages/PrescriptionDetail'
import LabReports from './pages/LabReports'
import LabReportDetail from './pages/LabReportDetail'
import DiagnosticStudies from './pages/DiagnosticStudies'
import DiagnosticStudyDetail from './pages/DiagnosticStudyDetail'
import Users from './pages/Users'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/institutions" element={<Institutions />} />
        <Route path="/institutions/:id" element={<InstitutionDetail />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorDetail />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/:id" element={<AppointmentDetail />} />
        <Route path="/conditions" element={<Conditions />} />
        <Route path="/conditions/:id" element={<ConditionDetail />} />
        <Route path="/medications" element={<Medications />} />
        <Route path="/medications/:id" element={<MedicationDetail />} />
        <Route path="/prescriptions" element={<Prescriptions />} />
        <Route path="/prescriptions/:id" element={<PrescriptionDetail />} />
        <Route path="/lab-reports" element={<LabReports />} />
        <Route path="/lab-reports/:id" element={<LabReportDetail />} />
        <Route path="/diagnostic-studies" element={<DiagnosticStudies />} />
        <Route path="/diagnostic-studies/:id" element={<DiagnosticStudyDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}
