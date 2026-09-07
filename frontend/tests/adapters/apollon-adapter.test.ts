import { describe, it, expect } from 'vitest';
import { UMLModel as CanonicalModel } from '../../src/types/canonical-model';
import { apollonToCanonical, canonicalToApollon } from '../../src/adapters/apollon-adapter';

describe('Apollon Adapter', () => {
  it('should round-trip a basic class diagram semantically', () => {
    const canonical: CanonicalModel = {
      id: 'm1',
      name: 'Test Model',
      classes: [
        {
          id: 'c1',
          name: 'User',
          attributes: [{ id: 'a1', name: 'id', type: 'String' }],
          operations: [{ id: 'o1', name: 'login', return_type: 'void' }]
        },
        {
          id: 'c2',
          name: 'Profile',
          attributes: [{ id: 'a2', name: 'bio', type: 'String' }],
          operations: []
        }
      ],
      relationships: [
        {
          id: 'r1',
          source_id: 'c1',
          target_id: 'c2',
          type: 'Association'
        }
      ],
      components: [],
      interfaces: [],
      diagrams: []
    };

    const apollon = canonicalToApollon(canonical);
    expect(apollon.nodes.length).toBeGreaterThan(0); // 2 classes + 1 attr + 1 op = 4 nodes
    expect(apollon.edges.length).toBe(1);

    const backToCanonical = apollonToCanonical(apollon);
    expect(backToCanonical.classes.length).toBe(2);
    expect(backToCanonical.relationships.length).toBe(1);
    
    // Check class User
    const userClass = backToCanonical.classes.find(c => c.id === 'c1');
    expect(userClass).toBeDefined();
    expect(userClass?.name).toBe('User');
    expect(userClass?.attributes[0].name).toBe('id');
    expect(userClass?.attributes[0].type).toBe('String');
    expect(userClass?.operations[0].name).toBe('login');
    expect(userClass?.operations[0].return_type).toBe('void');
  });
});
