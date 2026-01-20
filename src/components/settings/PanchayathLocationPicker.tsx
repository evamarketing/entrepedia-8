import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Countries list (common ones first, then alphabetical)
const COUNTRIES = [
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Oman',
  'Bahrain',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Singapore',
  'Malaysia',
];

// Kerala Districts
const KERALA_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
];

// Common panchayaths by district (for autocomplete suggestions)
const COMMON_PANCHAYATHS: Record<string, string[]> = {
  'Thiruvananthapuram': ['Nemom', 'Kazhakkoottam', 'Vattiyoorkavu', 'Sreekaryam', 'Pallipuram', 'Venganoor'],
  'Kollam': ['Chavara', 'Karunagappally', 'Oachira', 'Punalur', 'Kundara', 'Paravur'],
  'Pathanamthitta': ['Thiruvalla', 'Adoor', 'Pandalam', 'Ranni', 'Kozhencherry'],
  'Alappuzha': ['Cherthala', 'Kayamkulam', 'Haripad', 'Mavelikara', 'Ambalapuzha'],
  'Kottayam': ['Changanassery', 'Pala', 'Vaikom', 'Ettumanoor', 'Erattupetta'],
  'Idukki': ['Thodupuzha', 'Adimali', 'Kattappana', 'Munnar', 'Nedumkandam'],
  'Ernakulam': ['Aluva', 'Angamaly', 'Perumbavoor', 'Muvattupuzha', 'Kothamangalam', 'Kakkanad'],
  'Thrissur': ['Kodungallur', 'Chalakudy', 'Irinjalakuda', 'Kunnamkulam', 'Guruvayur'],
  'Palakkad': ['Ottapalam', 'Chittur', 'Mannarkkad', 'Pattambi', 'Shoranur'],
  'Malappuram': ['Manjeri', 'Perinthalmanna', 'Tirur', 'Ponnani', 'Nilambur', 'Kondotty'],
  'Kozhikode': ['Vatakara', 'Koyilandy', 'Feroke', 'Ramanattukara', 'Mukkom'],
  'Wayanad': ['Kalpetta', 'Sulthan Bathery', 'Mananthavady', 'Panamaram'],
  'Kannur': ['Thalassery', 'Kannur', 'Payyanur', 'Taliparamba', 'Iritty'],
  'Kasaragod': ['Kanhangad', 'Nileshwaram', 'Manjeshwaram', 'Uppala', 'Cheruvathur']
};

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function PanchayathLocationPicker({ value, onChange }: LocationPickerProps) {
  const [country, setCountry] = useState('India');
  const [district, setDistrict] = useState('');
  const [panchayath, setPanchayath] = useState('');
  const [place, setPlace] = useState('');

  // Parse existing location value
  useEffect(() => {
    if (!value) return;

    const parts = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) return;

    // Prefer detecting country by matching known countries to avoid "India, India" duplication
    const last = parts[parts.length - 1];
    const hasExplicitCountry = COUNTRIES.includes(last);

    const nextCountry = hasExplicitCountry ? last : 'India';
    const remaining = hasExplicitCountry ? parts.slice(0, -1) : parts;

    setPlace(remaining[0] || '');
    setPanchayath(remaining[1] || '');
    setDistrict(remaining[2] || '');
    setCountry(nextCountry);
  }, [value]);

  // Update parent when location changes - use ref to prevent initial call
  const initialRender = useRef(true);
  
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const locationParts = [place, panchayath, district, country].filter(Boolean);
    onChange(locationParts.join(', '));
  }, [country, district, panchayath, place, onChange]);

  // Get suggestions for panchayath based on selected district
  const panchayathSuggestions = district ? COMMON_PANCHAYATHS[district] || [] : [];
  const showPanchayathSelect = panchayathSuggestions.length > 0 && !panchayath;

  return (
    <div className="space-y-4">
      {/* Country */}
      <div className="space-y-2">
        <Label>Country</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* District - Only show for India */}
      {country === 'India' && (
        <div className="space-y-2">
          <Label>District</Label>
          <Select value={district} onValueChange={(val) => {
            setDistrict(val);
            setPanchayath(''); // Reset panchayath when district changes
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {KERALA_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Panchayath - Show select if suggestions available, otherwise text input */}
      <div className="space-y-2">
        <Label>Panchayath / Municipality</Label>
        {showPanchayathSelect ? (
          <div className="space-y-2">
            <Select value={panchayath} onValueChange={setPanchayath}>
              <SelectTrigger>
                <SelectValue placeholder="Select or type panchayath" />
              </SelectTrigger>
              <SelectContent>
                {panchayathSuggestions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Or type below if not in list
            </p>
            <Input
              placeholder="Type panchayath name if not in list"
              value={panchayath}
              onChange={(e) => setPanchayath(e.target.value)}
            />
          </div>
        ) : (
          <Input
            placeholder="Enter your panchayath / municipality"
            value={panchayath}
            onChange={(e) => setPanchayath(e.target.value)}
          />
        )}
      </div>

      {/* Place */}
      <div className="space-y-2">
        <Label>Place / Area</Label>
        <Input
          placeholder="Enter your place or area name"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Your specific locality or area name
        </p>
      </div>

      {/* Location Preview */}
      {(place || panchayath || district || country) && (
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-sm font-medium text-foreground">Your Location:</p>
          <p className="text-sm text-muted-foreground">
            {[place, panchayath, district, country].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
