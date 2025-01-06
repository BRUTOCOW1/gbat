import { Routes } from '@angular/router';
import {GolfComponent} from './golf/golf.component';
import {GolfShotComponent} from './golf-shot/golf-shot.component';
import {RoundComponent} from './round/round.component';

import {BlogComponent} from './blog/blog.component';

export const routes: Routes = [
    
    // Individual Components
    { 
        path: 'golf-component', 
        component: GolfComponent,
    },
    { 
        path: 'golf-shot-component', 
        component: GolfShotComponent,
    },
    { 
        path: 'blog-component', 
        component: BlogComponent 
    },
    { 
        path: 'round-component', 
        component: RoundComponent,
    },


    // Pathways
    { 
        path: 'blog-component/golf-component', 
        redirectTo: 'golf-component'
    },
    { 
        path: 'golf-shot-component/golf-component', 
        redirectTo: 'golf-component'
    },
    { 
        path: 'golf-component/golf-shot-component', 
        redirectTo: 'golf-shot-component'
    },
    { 
        path: 'golf-component/round-component', 
        redirectTo: 'round-component'
    },
    { 
        path: 'golf-component/blog-component', 
        redirectTo: 'blog-component'
    }
];
