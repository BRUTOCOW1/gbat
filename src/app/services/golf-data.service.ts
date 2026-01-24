import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GolfCourse, GolfHole } from '../shared/models/golf-course.model';

@Injectable({
    providedIn: 'root'
})
export class GolfDataService {
    // TODO: Replace with actual API endpoint and Key
    private apiUrl = 'https://golf-course-api.com/v1';
    private apiKey = 'YOUR_API_KEY';

    constructor(private http: HttpClient) { }

    /**
     * Search for courses in the external database.
     * @param query Name of the course
     */
    searchExternalCourses(query: string): Observable<any[]> {
        // MOCK IMPLEMENTATION for demonstration until API key is set
        // In a real scenario:
        // return this.http.get(`${this.apiUrl}/courses?search=${query}`, { headers: { 'Authorization': this.apiKey } });

        const mockResults = [
            {
                course_id: 'ext_1',
                course_name: 'Pebble Beach Golf Links',
                location: 'Pebble Beach, CA',
                holes: 18
            },
            {
                course_id: 'ext_2',
                course_name: 'Augusta National',
                location: 'Augusta, GA',
                holes: 18
            },
            {
                course_id: 'ext_3',
                course_name: 'St Andrews Links (Old Course)',
                location: 'St Andrews, Scotland',
                holes: 18
            }
        ].filter(c => c.course_name.toLowerCase().includes(query.toLowerCase()));

        return of(mockResults);
    }

    /**
     * Get full details for a specific external course.
     * @param externalId 
     */
    getExternalCourseDetails(externalId: string): Observable<Partial<GolfCourse> | null> {
        // MOCK IMPLEMENTATION
        if (externalId === 'ext_1') {
            return of(this.getMockPebbleBeach());
        }
        return of(null);
    }

    private getMockPebbleBeach(): Partial<GolfCourse> {
        return {
            name: 'Pebble Beach Golf Links',
            location: 'Pebble Beach, CA',
            rating: 75.5,
            slope: 145,
            par: 72,
            external_id: 'ext_1',
            holes: Array.from({ length: 18 }, (_, i) => ({
                hole_number: i + 1,
                par: [3, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5][i], // Random-ish pars
                handicap: i + 1,
                course_id: '' // Will be filled on save
            }))
        };
    }
}
