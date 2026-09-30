import 'dotenv/config';
import dns from 'node:dns';
import { readFileSync } from 'node:fs';
import mongoose, { type Types } from 'mongoose';
import { Division } from '../../src/domains/setup/models/Division.model.js';
import { District } from '../../src/domains/setup/models/District.model.js';
import { Thana } from '../../src/domains/setup/models/Thana.model.js';

interface Place {
  name_en: string;
  name_bn: string;
}
interface GeoDivision extends Place {
  districts: Array<Place & { upazilas: Place[] }>;
}

/**
 * Imports all 8 divisions, 64 districts and their upazilas from scripts/data/bd-geography.json.
 * Idempotent: existing rows are matched by name (old spellings included) under the same parent and
 * kept, so ids referenced by offices, users and blood requests never change. Nothing is deleted.
 */
const DIVISION_CODES: Record<string, string> = {
  Barishal: 'BAR',
  Chattogram: 'CTG',
  Dhaka: 'DHK',
  Khulna: 'KHL',
  Mymensingh: 'MYM',
  Rajshahi: 'RAJ',
  Rangpur: 'RNG',
  Sylhet: 'SYL',
};

const OLD_NAMES: Record<string, string[]> = {
  Chattogram: ['Chittagong', 'Chattagram'],
  Barishal: ['Barisal'],
  Cumilla: ['Comilla'],
  Jashore: ['Jessore'],
  Bogura: ['Bogra'],
};

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const keysOf = (name: string) => [name, ...(OLD_NAMES[name] ?? [])].map(key);

interface Row {
  _id: Types.ObjectId;
  name_en: string;
  name_bn?: string;
  short_code: string;
}

function finder(rows: Row[]) {
  const byName = new Map(rows.map((r) => [key(r.name_en), r]));
  return (name: string) => keysOf(name).map((k) => byName.get(k)).find(Boolean);
}

async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  const data = JSON.parse(readFileSync(new URL('../data/bd-geography.json', import.meta.url), 'utf8')) as GeoDivision[];
  await mongoose.connect(uri);

  const stats = { divisions: [0, 0], districts: [0, 0], upazilas: [0, 0], bn_filled: 0 };
  const fillBn = async (model: typeof Division | typeof District | typeof Thana, row: Row, bn: string) => {
    if (row.name_bn || !bn) return;
    await (model as typeof Division).updateOne({ _id: row._id }, { $set: { name_bn: bn } });
    stats.bn_filled++;
  };

  const findDivision = finder(await Division.find({}).select('name_en name_bn short_code').lean<Row[]>());
  const usedDistrictCodes = new Set((await District.find({}).select('short_code').lean()).map((d) => d.short_code));

  for (const dv of data) {
    let division = findDivision(dv.name_en);
    if (division) {
      stats.divisions[1]!++;
      await fillBn(Division, division, dv.name_bn);
    } else {
      const created = await Division.create({ name_en: dv.name_en, name_bn: dv.name_bn, short_code: DIVISION_CODES[dv.name_en] ?? dv.name_en.slice(0, 3).toUpperCase() });
      division = { _id: created._id as Types.ObjectId, name_en: created.name_en, short_code: created.short_code };
      stats.divisions[0]!++;
    }

    const findDistrict = finder(await District.find({ division_id: division._id }).select('name_en name_bn short_code').lean<Row[]>());
    for (const ds of dv.districts) {
      let district = findDistrict(ds.name_en);
      if (district) {
        stats.districts[1]!++;
        await fillBn(District, district, ds.name_bn);
      } else {
        let code = ds.name_en.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        for (let n = 2; usedDistrictCodes.has(code); n++) code = `${code.slice(0, 3)}${n}`;
        usedDistrictCodes.add(code);
        const created = await District.create({ division_id: division._id, name_en: ds.name_en, name_bn: ds.name_bn, short_code: code });
        district = { _id: created._id as Types.ObjectId, name_en: created.name_en, short_code: created.short_code };
        stats.districts[0]!++;
      }

      const existing = await Thana.find({ district_id: district._id }).select('name_en name_bn short_code').lean<Row[]>();
      const findThana = finder(existing);
      const usedCodes = new Set(existing.map((t) => t.short_code));
      let seq = 1;
      const fresh = [];
      for (const up of ds.upazilas) {
        const thana = findThana(up.name_en);
        if (thana) {
          stats.upazilas[1]!++;
          await fillBn(Thana, thana, up.name_bn);
          continue;
        }
        let code = '';
        do code = `${district.short_code}-${String(seq++).padStart(2, '0')}`;
        while (usedCodes.has(code));
        usedCodes.add(code);
        fresh.push({ district_id: district._id, name_en: up.name_en, name_bn: up.name_bn, short_code: code });
      }
      if (fresh.length) await Thana.insertMany(fresh);
      stats.upazilas[0]! += fresh.length;
    }
  }

  const fmt = ([added, kept]: number[]) => `${added} added, ${kept} already there`;
  console.log(`Divisions: ${fmt(stats.divisions)}`);
  console.log(`Districts: ${fmt(stats.districts)}`);
  console.log(`Upazilas:  ${fmt(stats.upazilas)}`);
  console.log(`Bangla names filled on existing rows: ${stats.bn_filled}`);
  console.log(
    `Totals now: ${await Division.countDocuments()} divisions, ${await District.countDocuments()} districts, ${await Thana.countDocuments()} upazilas/thanas`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
