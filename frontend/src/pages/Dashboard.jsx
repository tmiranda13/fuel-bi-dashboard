/**
 * Dashboard Page - With Tab Navigation
 * Includes Vendas, Compras, Estoque, and Metas tabs
 */
import { useState } from 'react';
import { Container, Nav, Navbar, Tab, Tabs } from 'react-bootstrap';
import { useAuth } from '../App';
import Vendas from '../components/tabs/Vendas';
import Compras from '../components/tabs/Compras';
import Estoque from '../components/tabs/Estoque';
import Metas from '../components/tabs/Metas';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('vendas');
  const { profile, companyName, userName, logout, isManager, isSuperAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.clear();
    window.location.href = '/login';
  };

  // Check if user has manager or super_admin role
  const isManagerOrAdmin = isManager || isSuperAdmin;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Top Navigation Bar */}
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container fluid>
          <Navbar.Brand href="#home">
            Fuel BI Dashboard
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Nav.Link className="text-light me-3">
                {companyName || 'Dashboard'}
              </Nav.Link>
              <Nav.Link className="text-light me-3">
                {userName || profile?.email}
              </Nav.Link>
              <Nav.Link onClick={handleLogout} className="text-warning" style={{ cursor: 'pointer' }}>
                Logout
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Main Content with Tabs */}
      <Container fluid className="px-4">
        <Tabs
          id="dashboard-tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-4"
        >
          <Tab eventKey="vendas" title="Vendas">
            <Vendas />
          </Tab>
          <Tab eventKey="compras" title="Compras">
            <Compras />
          </Tab>
          <Tab eventKey="estoque" title="Estoque">
            <Estoque />
          </Tab>
          {isManagerOrAdmin && (
            <Tab eventKey="metas" title="Metas">
              <Metas />
            </Tab>
          )}
        </Tabs>
      </Container>
    </div>
  );
}