import { parse } from 'parse-gedcom';
import _ from 'lodash';

export interface GedcomRecord {
  id: string;
  tag: string;
  data: any;
  raw: any;
}

export interface DiffResult {
  added: GedcomRecord[];
  removed: GedcomRecord[];
  modified: {
    id: string;
    tag: string;
    oldData: any;
    newData: any;
    changes: {
      key: string;
      humanKey: string;
      oldValue: any;
      newValue: any;
    }[];
  }[];
}

export function parseGedcom(content: string): GedcomRecord[] {
  try {
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lines = cleanContent.split(/\r?\n/);
    
    // Manual robust parser
    const rootNodes: any[] = [];
    const stack: any[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const match = trimmed.match(/^(\d+)\s+(@[^@]+@)?\s*(\w+)?\s*(.*)$/);
      if (!match) return;

      const level = parseInt(match[1]);
      const pointer = match[2] ? match[2].trim() : undefined;
      const tag = match[3] ? match[3].trim() : undefined;
      const value = match[4] ? match[4].trim() : undefined;

      // Handle the case where the level doesn't match the stack depth
      while (stack.length > level) {
        stack.pop();
      }

      const node: any = {
        level,
        pointer,
        tag,
        value,
        tree: []
      };

      // Handle CONC/CONT tags for multi-line strings
      if (tag === 'CONC' || tag === 'CONT') {
        const parent = stack[stack.length - 1];
        if (parent) {
          const separator = tag === 'CONT' ? '\n' : '';
          parent.value = (parent.value || '') + separator + (value || '');
          return;
        }
      }

      if (level === 0) {
        rootNodes.push(node);
        stack.push(node);
      } else {
        const parent = stack[level - 1];
        if (parent) {
          parent.tree.push(node);
          stack[level] = node;
        }
      }
    });

    const records = rootNodes
      .filter(node => node.pointer)
      .map(node => ({
        id: node.pointer,
        tag: node.tag,
        data: simplifyNode(node),
        raw: node
      }));

    return records;
  } catch (error) {
    console.error('GEDCOM Parsing Error:', error);
    throw error;
  }
}

function simplifyNode(node: any): any {
  if (!node.tree || node.tree.length === 0) {
    return node.value || '';
  }

  const result: any = { value: node.value || '' };
  
  node.tree.forEach((child: any) => {
    const key = child.tag;
    const simplified = simplifyNode(child);
    
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(simplified);
      } else {
        result[key] = [result[key], simplified];
      }
    } else {
      result[key] = simplified;
    }
  });
  
  return result;
}

const TAG_MAPPING: Record<string, string> = {
  'INDI': 'Individual',
  'FAM': 'Family',
  'NAME': 'Name',
  'BIRT': 'Birth',
  'DEAT': 'Death',
  'MARR': 'Marriage',
  'DIV': 'Divorce',
  'DATE': 'Date',
  'PLAC': 'Place',
  'SEX': 'Gender',
  'FAMS': 'Family Spouse',
  'FAMC': 'Family Child',
  'HUSB': 'Husband',
  'WIFE': 'Wife',
  'CHIL': 'Child',
  'OCCU': 'Occupation',
  'RESI': 'Residence',
  'NOTE': 'Note',
  'SOUR': 'Source',
  'CHAN': 'Changed',
  'BAPM': 'Baptism',
  'BURI': 'Burial',
  'CHR': 'Christening',
  'ADOP': 'Adoption',
  'AFN': 'Ancestral File Number',
  'TITL': 'Title',
};

function getTagName(tag: string): string {
  return TAG_MAPPING[tag] || tag;
}

function isEqualUnordered(objValue: any, othValue: any): boolean | undefined {
  if (Array.isArray(objValue) && Array.isArray(othValue)) {
    if (objValue.length !== othValue.length) return false;
    const copiedOther = [...othValue];
    for (const v of objValue) {
      const index = copiedOther.findIndex(o => _.isEqualWith(v, o, isEqualUnordered));
      if (index !== -1) {
        copiedOther.splice(index, 1);
      } else {
        return false;
      }
    }
    return true;
  }
  return undefined;
}

export function compareGedcoms(oldRecords: GedcomRecord[], newRecords: GedcomRecord[]): DiffResult {
  const oldMap = _.keyBy(oldRecords, 'id');
  const newMap = _.keyBy(newRecords, 'id');

  const added: GedcomRecord[] = [];
  const removed: GedcomRecord[] = [];
  const modified: DiffResult['modified'] = [];

  const allIds = _.union(Object.keys(oldMap), Object.keys(newMap));

  allIds.forEach(id => {
    const oldRec = oldMap[id];
    const newRec = newMap[id];

    if (!oldRec && newRec) {
      added.push(newRec);
    } else if (oldRec && !newRec) {
      removed.push(oldRec);
    } else if (oldRec && newRec) {
      if (!_.isEqualWith(oldRec.data, newRec.data, isEqualUnordered)) {
        const changes = getDetailedChanges(oldRec.data, newRec.data);
        if (changes.length > 0) {
          modified.push({
            id,
            tag: oldRec.tag,
            oldData: oldRec.data,
            newData: newRec.data,
            changes
          });
        }
      }
    }
  });

  return { added, removed, modified };
}

function getDetailedChanges(oldData: any, newData: any, prefix = '', humanPrefix = ''): any[] {
  const changes: any[] = [];
  const allKeys = _.union(Object.keys(oldData), Object.keys(newData));

  allKeys.forEach(key => {
    const oldVal = oldData[key];
    const newVal = newData[key];

    if (!_.isEqualWith(oldVal, newVal, isEqualUnordered)) {
      const humanKey = getTagName(key);
      const currentHumanPath = `${humanPrefix}${humanKey}`;
      const currentPath = `${prefix}${key}`;

      if (_.isObject(oldVal) && _.isObject(newVal) && !Array.isArray(oldVal) && !Array.isArray(newVal)) {
        changes.push(...getDetailedChanges(oldVal, newVal, `${currentPath}.`, `${currentHumanPath} > `));
      } else {
        changes.push({
          key: currentPath,
          humanKey: currentHumanPath,
          oldValue: oldVal,
          newValue: newVal
        });
      }
    }
  });

  return changes;
}
