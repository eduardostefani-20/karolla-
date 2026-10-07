import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BreedCombobox, OTHER_BREED } from '@/components/booking/BreedCombobox';

const breeds = ['Shih Tzu', 'Spitz Alemão', 'Poodle'].map((name, i) => ({ id: `b${i}`, speciesId: 'dog', name, defaultSizeId: null, active: true, sortOrder: i }));

describe('BreedCombobox', () => {
  it('filtra ignorando acentos e sempre oferece "Outra raça"', async () => {
    const onSelect = vi.fn();
    render(<BreedCombobox inputId="r" breeds={breeds} value={{ breedId: null, breedName: '', isOther: false }} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('combobox'), 'alema');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Spitz Alemão', 'Outra raça (digitar)']);
    await userEvent.click(options[0]!);
    expect(onSelect).toHaveBeenCalledWith(breeds[1]);
  });

  it('navega pelo teclado até "Outra raça"', async () => {
    const onSelect = vi.fn();
    render(<BreedCombobox inputId="r" breeds={breeds} value={{ breedId: null, breedName: '', isOther: false }} onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('combobox'), 'xyz{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(OTHER_BREED);
  });
});
