/**
 * Mock Data Badge Component
 * Visual indicator for sections using mock data
 */

import { Badge } from 'react-bootstrap';

export default function MockDataBadge() {
  return (
    <Badge
      bg="warning"
      text="dark"
      className="ms-2"
      title="This section uses mock data - real data not yet available"
    >
      MOCK DATA
    </Badge>
  );
}

export function MockDataCard({ children, title }) {
  return (
    <div
      style={{
        border: '2px dashed #ffc107',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: '#fff3cd20'
      }}
    >
      <div className="d-flex align-items-center mb-2">
        <h6 className="mb-0">{title}</h6>
        <MockDataBadge />
      </div>
      {children}
    </div>
  );
}
